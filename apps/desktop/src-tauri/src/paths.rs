use std::path::PathBuf;

pub fn app_data_dir() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir().ok_or_else(|| {
        "Impossible de déterminer le dossier de données utilisateur.".to_string()
    })?;
    let dir = base.join("CodeFlow");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn sandbox_dir() -> Result<PathBuf, String> {
    let dir = app_data_dir()?.join("sandbox");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn projects_dir() -> Result<PathBuf, String> {
    let dir = app_data_dir()?.join("projects");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn db_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("codeflow.db"))
}
