//! 模拟宿主握手、调度授权与资源回调

use gateway_plugin_sdk::{
    CallContext, Frame, Handshake, Manifest, Message, PROTOCOL_VERSION, PluginFault, Stage,
    client::{read_frame, write_frame},
};
use serde_json::{Value, json};
use std::{process::Stdio, time::Duration};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

pub struct Peer {
    _child: Child,
    reader: ChildStdout,
    writer: ChildStdin,
    next_id: u64,
}

impl Peer {
    pub async fn start() -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_conversation-lab"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let mut peer = Self {
            writer: child.stdin.take().unwrap(),
            reader: child.stdout.take().unwrap(),
            _child: child,
            next_id: 1,
        };
        let manifest = Manifest::from_author_slice(include_bytes!("../../../plugin.json")).unwrap();
        let frame = Frame::control(Message::Hello {
            handshake: Handshake {
                protocol_version: PROTOCOL_VERSION,
                artifact_sha256: "a".repeat(64),
                plugin_id: manifest.plugin_id().unwrap(),
                instance_id: "test".into(),
                generation: 1,
                incarnation: "test".into(),
                configuration: json!({}),
                contributes: manifest.contributes,
            },
        });
        write_frame(&mut peer.writer, &frame).await.unwrap();
        assert!(matches!(
            peer.receive().await.message,
            Message::Ready { .. }
        ));
        peer
    }

    async fn receive(&mut self) -> Frame {
        tokio::time::timeout(Duration::from_secs(10), read_frame(&mut self.reader))
            .await
            .expect("插件响应超时")
            .unwrap()
    }

    pub async fn api(
        &mut self,
        method: &str,
        path: &str,
        body: Option<Value>,
        mut callback: impl FnMut(&str, &Value) -> Result<Value, PluginFault>,
    ) -> (u64, Value) {
        self.next_id += 2;
        let id = self.next_id;
        let frame = Frame {
            message: Message::Call {
                id,
                method: "management.handle".into(),
                context: CallContext {
                    request: None,
                    call_id: id,
                    instance_id: "test".into(),
                    generation: 1,
                    incarnation: "test".into(),
                    stage: Stage::Management,
                    timeout_ms: 10_000,
                    resource_stream: false,
                    resource_scope_id: "test".into(),
                    request_id: None,
                    attempt_id: None,
                    account_id: None,
                    credential_revision: None,
                },
                params: json!({ "method": method, "path": path, "query": "", "content_type": body.as_ref().map(|_| "application/json") }),
            },
            payload: body.map_or_else(Vec::new, |value| serde_json::to_vec(&value).unwrap()),
        };
        write_frame(&mut self.writer, &frame).await.unwrap();
        loop {
            let frame = self.receive().await;
            match frame.message {
                Message::Callback {
                    id: callback_id,
                    parent_id,
                    method,
                    params,
                } => {
                    assert_eq!(parent_id, id);
                    let message = match callback(&method, &params) {
                        Ok(result) => Message::Result {
                            id: callback_id,
                            result,
                        },
                        Err(error) => Message::Error {
                            id: callback_id,
                            error,
                        },
                    };
                    write_frame(&mut self.writer, &Frame::control(message))
                        .await
                        .unwrap();
                }
                Message::Resume { id, epoch } => {
                    write_frame(
                        &mut self.writer,
                        &Frame::control(Message::Resumed { id, epoch }),
                    )
                    .await
                    .unwrap();
                }
                Message::Suspend { .. } | Message::CallbackConsumed { .. } => {}
                Message::Result {
                    id: result_id,
                    result,
                } => {
                    assert_eq!(result_id, id);
                    return (
                        result["status"].as_u64().unwrap(),
                        serde_json::from_slice(&frame.payload).unwrap(),
                    );
                }
                message => panic!("未预期的消息：{message:?}"),
            }
        }
    }
}
