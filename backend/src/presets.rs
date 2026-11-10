//! 维护插件预设的格式与容量约束

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Debug, Deserialize, Serialize)]
pub(crate) struct Presets {
    pub entries: Vec<Preset>,
}

#[derive(Debug, Deserialize, Serialize)]
pub(crate) struct Preset {
    pub id: String,
    pub name: String,
    pub mode: Mode,
    pub messages: Vec<Message>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Mode {
    Fixed,
    Random,
}

#[derive(Debug, Deserialize, Serialize)]
pub(crate) struct Message {
    pub role: Role,
    pub content: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Role {
    System,
    User,
    Assistant,
}

impl Presets {
    pub(crate) fn validate(&self) -> Result<(), &'static str> {
        if self.entries.len() > 32 {
            return Err("最多保存 32 个预设");
        }
        let mut ids = BTreeSet::new();
        for preset in &self.entries {
            if preset.id.is_empty() || preset.id.len() > 128 || !ids.insert(&preset.id) {
                return Err("预设标识为空、重复或过长");
            }
            if preset.name.trim().is_empty() || preset.name.len() > 256 {
                return Err("预设名称须为 1–256 个 UTF-8 字节");
            }
            if preset.messages.is_empty() || preset.messages.len() > 32 {
                return Err("每个预设须包含 1–32 条消息");
            }
            if preset.messages.iter().any(|message| {
                message.content.trim().is_empty() || message.content.len() > 16 * 1024
            }) {
                return Err("每条消息须为 1–16384 个 UTF-8 字节");
            }
        }
        if serde_json::to_vec(self).map_or(true, |bytes| bytes.len() > 256 * 1024) {
            return Err("预设总大小超过 256 KiB");
        }
        Ok(())
    }
}
