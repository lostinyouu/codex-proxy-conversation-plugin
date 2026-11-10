//! 验证默认 Key、模型与推理强度的存取及输入约束

use crate::support::Peer;
use serde_json::{Value, json};

pub fn defaults() -> Value {
    json!({ "clientKeyId": "selected-key", "modelId": "selected-model", "reasoningEffort": "high" })
}

#[tokio::test]
async fn preferences_round_trip_in_their_own_namespace() {
    let mut peer = Peer::start().await;
    let (status, empty) = peer
        .api("GET", "api/preferences", None, |method, params| {
            assert_eq!(method, "host.state.get");
            assert_eq!(params["namespace"], "preferences");
            assert_eq!(params["key"], "defaults");
            Ok(json!({ "record": null }))
        })
        .await;
    assert_eq!(
        (status, empty),
        (200, json!({ "version": null, "value": null }))
    );

    let mut stored = Value::Null;
    let (status, saved) = peer
        .api(
            "POST",
            "api/preferences",
            Some(json!({ "expectedVersion": null, "value": defaults() })),
            |method, params| {
                assert_eq!(method, "host.state.put");
                assert_eq!(params["namespace"], "preferences");
                assert_eq!(params["expected_version"], Value::Null);
                stored = params["value"].clone();
                Ok(json!({ "version": 1 }))
            },
        )
        .await;
    assert_eq!((status, saved), (200, json!({ "version": 1 })));

    let (status, loaded) = peer
        .api("GET", "api/preferences", None, |_, _| {
            Ok(json!({ "record": { "value": stored, "schema_version": 1, "version": 1 } }))
        })
        .await;
    assert_eq!(
        (status, loaded),
        (200, json!({ "version": 1, "value": defaults() }))
    );
}

#[tokio::test]
async fn invalid_defaults_do_not_write_state() {
    let mut peer = Peer::start().await;
    let mut blank_key = defaults();
    blank_key["clientKeyId"] = json!("   ");
    let mut long_model = defaults();
    long_model["modelId"] = json!("模".repeat(100));
    let mut invalid_effort = defaults();
    invalid_effort["reasoningEffort"] = json!("unsupported-effort");
    for value in [blank_key, long_model, invalid_effort] {
        let (status, _) = peer
            .api(
                "POST",
                "api/preferences",
                Some(json!({ "expectedVersion": null, "value": value })),
                |method, _| panic!("无效默认设置不应调用 {method}"),
            )
            .await;
        assert_eq!(status, 400);
    }
}
