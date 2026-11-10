//! 提供 Key、模型目录与带版本校验的预设及默认设置接口

use crate::{preferences::Preferences, presets::Presets};
use gateway_plugin_sdk::{
    ErrorCode, PluginFault,
    call::{
        host::{
            KeyListRequest, KeyListResult, ModelListRequest, ModelListResult, StateGetRequest,
            StateGetResult, StatePutRequest, StatePutResult,
        },
        management::{
            ManagementPage, ManagementRegistration, ManagementRequest, ManagementResource,
            ManagementResponse, ManagementRoute,
        },
    },
    client::{HostClient, SessionError, TypedCall, TypedReply},
};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::{Value, json};

const JSON: &str = "application/json";
const NAMESPACE: &str = "presets";
const KEY: &str = "collection";
const PREFERENCES_NAMESPACE: &str = "preferences";
const PREFERENCES_KEY: &str = "defaults";

pub(crate) fn registration() -> ManagementRegistration {
    ManagementRegistration {
        routes: [
            ("POST", "api/keys"),
            ("POST", "api/models"),
            ("GET", "api/presets"),
            ("POST", "api/presets"),
            ("GET", "api/preferences"),
            ("POST", "api/preferences"),
        ]
        .into_iter()
        .map(|(method, path)| ManagementRoute {
            method: method.into(),
            path: path.into(),
            request_content_types: if method == "GET" {
                vec![]
            } else {
                vec![JSON.into()]
            },
            response_content_types: vec![JSON.into()],
        })
        .collect(),
        resources: [
            "LICENSE",
            "NOTICE",
            "web/index.html",
            "web/app.js",
            "web/app.css",
        ]
        .into_iter()
        .map(|path| ManagementResource {
            path: path.into(),
            public: false,
        })
        .collect(),
        pages: vec![ManagementPage {
            id: "conversation-lab".into(),
            title: "对话实验室".into(),
            description: Some("选择模型，发送固定或随机对话并查看回复".into()),
            entry: "web/index.html".into(),
            icon: None,
        }],
        callbacks: vec![],
    }
}

#[derive(Debug)]
struct ApiError(u16, &'static str, String);

impl ApiError {
    fn invalid(message: impl Into<String>) -> Self {
        Self(400, "invalid_request", message.into())
    }
}

impl From<PluginFault> for ApiError {
    fn from(error: PluginFault) -> Self {
        if error.code == ErrorCode::Conflict {
            Self(
                409,
                "conflict",
                "保存内容已在其他页面更新，请重新载入后再保存".into(),
            )
        } else {
            Self(502, "host_callback", "宿主操作未完成".into())
        }
    }
}

pub(crate) async fn handle(
    call: TypedCall<ManagementRequest>,
) -> Result<TypedReply<ManagementResponse>, PluginFault> {
    let result = dispatch(call).await;
    let (status, value) = match result {
        Ok(value) => (200, value),
        Err(ApiError(status, code, message)) => (
            status,
            json!({ "error": { "code": code, "message": message } }),
        ),
    };
    let payload = serde_json::to_vec(&value)
        .map_err(|_| PluginFault::new(ErrorCode::Fault, "管理接口响应编码失败"))?;
    Ok(TypedReply::new(ManagementResponse {
        status,
        content_type: JSON.into(),
        headers: vec![],
    })
    .with_payload(payload))
}

async fn dispatch(call: TypedCall<ManagementRequest>) -> Result<Value, ApiError> {
    if !call.request.query.is_empty() {
        return Err(ApiError::invalid("此接口不接受查询参数"));
    }
    match (call.request.method.as_str(), call.request.path.as_str()) {
        ("POST", "api/keys") => {
            #[derive(Deserialize)]
            struct Input {
                cursor: Option<String>,
            }
            let input: Input = decode(&call)?;
            let result: KeyListResult = host_call(
                &call.host,
                "host.keys.list",
                &KeyListRequest {
                    cursor: input.cursor,
                    limit: 100,
                },
            )
            .await?;
            encode(result)
        }
        ("POST", "api/models") => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct Input {
                client_key_id: String,
            }
            let input: Input = decode(&call)?;
            if input.client_key_id.trim().is_empty() {
                return Err(ApiError::invalid("请选择客户端 Key"));
            }
            let result: ModelListResult = host_call(
                &call.host,
                "host.models.list",
                &ModelListRequest {
                    client_key_id: input.client_key_id,
                    protocol: "openai".into(),
                    client_version: concat!("conversation-lab/", env!("CARGO_PKG_VERSION")).into(),
                },
            )
            .await?;
            encode(result)
        }
        ("GET", "api/presets") => {
            if !call.payload.is_empty() {
                return Err(ApiError::invalid("GET 请求不能包含正文"));
            }
            let result: StateGetResult = host_call(
                &call.host,
                "host.state.get",
                &StateGetRequest {
                    namespace: NAMESPACE.into(),
                    key: KEY.into(),
                },
            )
            .await?;
            match result.record {
                None => Ok(json!({ "version": null, "value": null })),
                Some(record) => {
                    let value: Presets = serde_json::from_value(record.value).map_err(|_| {
                        ApiError(500, "invalid_state", "已保存的预设格式无效".into())
                    })?;
                    if record.schema_version != 1 || value.validate().is_err() {
                        return Err(ApiError(
                            500,
                            "invalid_state",
                            "已保存的预设格式无效".into(),
                        ));
                    }
                    Ok(json!({ "version": record.version, "value": value }))
                }
            }
        }
        ("POST", "api/presets") => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct Input {
                expected_version: Option<u64>,
                value: Presets,
            }
            let input: Input = decode(&call)?;
            input.value.validate().map_err(ApiError::invalid)?;
            let result: StatePutResult = host_call(
                &call.host,
                "host.state.put",
                &StatePutRequest {
                    namespace: NAMESPACE.into(),
                    key: KEY.into(),
                    value: encode(input.value)?,
                    expected_version: input.expected_version,
                },
            )
            .await?;
            encode(result)
        }
        ("GET", "api/preferences") => {
            if !call.payload.is_empty() {
                return Err(ApiError::invalid("GET 请求不能包含正文"));
            }
            let result: StateGetResult = host_call(
                &call.host,
                "host.state.get",
                &StateGetRequest {
                    namespace: PREFERENCES_NAMESPACE.into(),
                    key: PREFERENCES_KEY.into(),
                },
            )
            .await?;
            match result.record {
                None => Ok(json!({ "version": null, "value": null })),
                Some(record) => {
                    let value: Preferences =
                        serde_json::from_value(record.value).map_err(|_| {
                            ApiError(500, "invalid_state", "已保存的默认设置格式无效".into())
                        })?;
                    if record.schema_version != 1 || value.validate().is_err() {
                        return Err(ApiError(
                            500,
                            "invalid_state",
                            "已保存的默认设置格式无效".into(),
                        ));
                    }
                    Ok(json!({ "version": record.version, "value": value }))
                }
            }
        }
        ("POST", "api/preferences") => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct Input {
                expected_version: Option<u64>,
                value: Preferences,
            }
            let input: Input = decode(&call)?;
            input.value.validate().map_err(ApiError::invalid)?;
            let result: StatePutResult = host_call(
                &call.host,
                "host.state.put",
                &StatePutRequest {
                    namespace: PREFERENCES_NAMESPACE.into(),
                    key: PREFERENCES_KEY.into(),
                    value: encode(input.value)?,
                    expected_version: input.expected_version,
                },
            )
            .await?;
            encode(result)
        }
        _ => Err(ApiError(404, "not_found", "接口不存在".into())),
    }
}

fn decode<T: DeserializeOwned>(call: &TypedCall<ManagementRequest>) -> Result<T, ApiError> {
    if call.payload.len() > 512 * 1024 {
        return Err(ApiError::invalid("请求正文超过 512 KiB"));
    }
    serde_json::from_slice(&call.payload).map_err(|_| ApiError::invalid("请求正文格式无效"))
}

fn encode(value: impl Serialize) -> Result<Value, ApiError> {
    serde_json::to_value(value).map_err(|_| ApiError(500, "encoding", "响应编码失败".into()))
}

async fn host_call<I: Serialize, O: DeserializeOwned>(
    host: &HostClient,
    method: &str,
    input: &I,
) -> Result<O, ApiError> {
    let reply = host
        .call(method, encode(input)?, vec![])
        .await
        .map_err(SessionError::into_plugin_fault)?;
    serde_json::from_value(reply.result)
        .map_err(|_| ApiError(502, "host_callback", "宿主返回了无效响应".into()))
}
