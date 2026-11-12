window.ARCHIVE_CONFIG = { apiKey: "", projects: [] };
window.ARCHIVE_PROJECTS_PROMISE = fetch("archive-projects.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Project configuration returned an error (${response.status}).`);
    }
    return response.json();
  })
  .then((projects) => {
    if (!Array.isArray(projects)) {
      throw new Error("Project configuration must be a list.");
    }
    window.ARCHIVE_CONFIG.projects = projects;
    return projects;
  });
