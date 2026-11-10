//! 启动对话实验室的管理扩展会话

mod management;
mod presets;

use gateway_plugin_sdk::{
    Manifest,
    client::{PluginBuilder, PluginSession, SessionConfig, SessionError},
};

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let session = PluginSession::accept(
        tokio::io::stdin(),
        tokio::io::stdout(),
        SessionConfig::default(),
    )
    .await?;
    let manifest = Manifest::from_author_slice(include_bytes!("../../plugin.json"))?;
    if session.handshake().plugin_id != manifest.plugin_id()?
        || session.handshake().contributes != manifest.contributes
    {
        return Err(SessionError::Handshake.into());
    }
    let plugin = PluginBuilder::from_json(include_bytes!("../../plugin.json"))?
        .management(management::registration(), management::handle)?
        .build()?;
    session.run(plugin).await?;
    Ok(())
}
