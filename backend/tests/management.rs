//! 验证目录身份、预设校验、持久化与保存冲突

use crate::support::Peer;
use gateway_plugin_sdk::{ErrorCode, PluginFault};
use serde_json::{Value, json};

fn preset() -> Value {
    json!({ "entries": [{ "id": "a", "name": "随机问答", "mode": "random", "messages": [
        { "role": "system", "content": "请简短回答" },
        { "role": "user", "content": "介绍{{choice:海洋|森林}}" }
    ] }] })
}

#[tokio::test]
async fn models_use_the_selected_key_identity() {
    let mut peer = Peer::start().await;
    let (status, value) = peer
        .api(
            "POST",
            "api/models",
            Some(json!({ "clientKeyId": "selected-key" })),
            |method, params| {
                assert_eq!(method, "host.models.list");
                assert_eq!(params["client_key_id"], "selected-key");
                Ok(json!({ "models": ["model-a"] }))
            },
        )
        .await;
    assert_eq!((status, value), (200, json!({ "models": ["model-a"] })));
}

#[tokio::test]
async fn save_and_load_presets_preserves_templates_and_version() {
    let mut peer = Peer::start().await;
    let input = preset();
    let mut stored = Value::Null;
    let (status, _) = peer
        .api(
            "POST",
            "api/presets",
            Some(json!({ "expectedVersion": null, "value": input })),
            |method, params| {
                assert_eq!(method, "host.state.put");
                assert_eq!(params["expected_version"], Value::Null);
                stored = params["value"].clone();
                Ok(json!({ "version": 1 }))
            },
        )
        .await;
    assert_eq!(status, 200);
    let (status, loaded) = peer
        .api("GET", "api/presets", None, |method, params| {
            assert_eq!(method, "host.state.get");
            assert_eq!(params["namespace"], "presets");
            Ok(json!({ "record": { "value": stored, "version": 1, "schema_version": 1 } }))
        })
        .await;
    assert_eq!(
        (status, loaded),
        (200, json!({ "version": 1, "value": input }))
    );
}

#[tokio::test]
async fn save_reports_conflict_without_retrying() {
    let mut peer = Peer::start().await;
    let mut calls = 0;
    let (status, value) = peer
        .api(
            "POST",
            "api/presets",
            Some(json!({ "expectedVersion": 4, "value": preset() })),
            |method, params| {
                calls += 1;
                assert_eq!(method, "host.state.put");
                assert_eq!(params["expected_version"], 4);
                Err(PluginFault::new(ErrorCode::Conflict, "conflict"))
            },
        )
        .await;
    assert_eq!(
        (status, value["error"]["code"].as_str(), calls),
        (409, Some("conflict"), 1)
    );
}

#[tokio::test]
async fn invalid_presets_do_not_write_state() {
    let mut peer = Peer::start().await;
    let mut cases = Vec::new();
    let mut empty_message = preset();
    empty_message["entries"][0]["messages"][0]["content"] = json!("   ");
    cases.push(empty_message);
    let mut duplicate = preset();
    let duplicate_entry = duplicate["entries"][0].clone();
    duplicate["entries"]
        .as_array_mut()
        .unwrap()
        .push(duplicate_entry);
    cases.push(duplicate);
    let mut oversized = preset();
    oversized["entries"][0]["messages"][0]["content"] = json!("字".repeat(6000));
    cases.push(oversized);
    for value in cases {
        let (status, _) = peer
            .api(
                "POST",
                "api/presets",
                Some(json!({ "expectedVersion": null, "value": value })),
                |method, _| panic!("无效预设不应调用 {method}"),
            )
            .await;
        assert_eq!(status, 400);
    }
}
