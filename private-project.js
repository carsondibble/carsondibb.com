(() => {
  const form = document.querySelector("[data-private-project-form]");
  const passwordInput = form?.querySelector('input[name="password"]');
  const submitButton = form?.querySelector('button[type="submit"]');
  const status = document.querySelector("[data-private-project-status]");
  const projects = window.PRIVATE_PROJECTS;

  if (!form || !passwordInput || !submitButton || !status) return;

  function getDestination(redirectUrl) {
    if (typeof redirectUrl !== "string" || !redirectUrl.trim()) return null;

    try {
      const destination = new URL(redirectUrl, window.location.href);
      const isSameOrigin = destination.origin === window.location.origin;
      const isAllowedProtocol =
        destination.protocol === "https:" ||
        (isSameOrigin && ["http:", "https:"].includes(destination.protocol));
      if (!isAllowedProtocol) return null;
      if (destination.username || destination.password) return null;
      return destination.href;
    } catch {
      return null;
    }
  }

  const configuredProjects = Array.isArray(projects)
    ? projects
        .filter((project) => project && typeof project.password === "string" && project.password.length > 0)
        .map((project) => ({ password: project.password, destination: getDestination(project.redirectUrl) }))
        .filter((project) => project.destination)
    : [];

  if (!configuredProjects.length) {
    status.textContent = "Private projects are not configured yet.";
    passwordInput.disabled = true;
    submitButton.disabled = true;
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const project = configuredProjects.find((item) => item.password === passwordInput.value);

    if (!project) {
      status.textContent = "That password did not match a private project.";
      passwordInput.select();
      return;
    }

    window.location.assign(project.destination);
  });
})();
