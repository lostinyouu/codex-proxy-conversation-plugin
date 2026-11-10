//! 保存模型调用的默认选择，不持有 Key 明文

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Preferences {
    pub client_key_id: String,
    pub model_id: String,
    pub reasoning_effort: ReasoningEffort,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ReasoningEffort {
    Default,
    None,
    Minimal,
    Low,
    Medium,
    High,
    Xhigh,
    Max,
}

impl Preferences {
    pub(crate) fn validate(&self) -> Result<(), &'static str> {
        if self.client_key_id.trim().is_empty() {
            return Err("请选择客户端 Key");
        }
        if self.client_key_id.len() > 256 {
            return Err("客户端 Key 标识超过 256 个 UTF-8 字节");
        }
        if self.model_id.trim().is_empty() {
            return Err("请选择模型");
        }
        if self.model_id.len() > 256 {
            return Err("模型标识超过 256 个 UTF-8 字节");
        }
        Ok(())
    }
}
