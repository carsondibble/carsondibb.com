(() => {
  const form = document.querySelector("[data-private-project-form]");
  const passwordInput = form?.querySelector('input[name="password"]');
  const submitButton = form?.querySelector('button[type="submit"]');
  const status = document.querySelector("[data-private-project-status]");
  const projects = window.PRIVATE_PROJECTS;
  const config = window.ARCHIVE_CONFIG;
  const projectGate = document.querySelector("[data-private-project-gate]");
  const projectGallery = document.querySelector("[data-private-project-gallery]");
  const galleryTitle = document.querySelector("[data-private-project-gallery-title]");
  const galleryDescription = document.querySelector("[data-private-project-gallery-description]");
  const cover = document.querySelector("[data-private-project-cover]");
  const photoGrid = document.querySelector("[data-private-project-photos]");
  const galleryStatus = document.querySelector("[data-private-project-gallery-status]");
  const folderLink = document.querySelector("[data-private-project-drive]");
  const dialog = document.querySelector("[data-lightbox]");

  if (
    !form ||
    !passwordInput ||
    !submitButton ||
    !status ||
    !config ||
    !projectGate ||
    !projectGallery ||
    !galleryTitle ||
    !galleryDescription ||
    !cover ||
    !photoGrid ||
    !galleryStatus ||
    !folderLink ||
    !dialog
  ) {
    return;
  }

  function getFolder(project) {
    if (typeof project.folderUrl !== "string") return null;

    try {
      const url = new URL(project.folderUrl);
      if (url.protocol !== "https:" || !["drive.google.com", "www.drive.google.com"].includes(url.hostname)) {
        return null;
      }

      const match = url.pathname.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
      return match ? { id: match[1], url: url.href } : null;
    } catch {
      return null;
    }
  }

  function isDriveFileId(fileId) {
    return typeof fileId === "string" && /^[a-zA-Z0-9_-]+$/.test(fileId);
  }

  function driveThumbnail(fileId, size = 1200) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
  }

  const configuredProjects = Array.isArray(projects)
    ? projects
        .filter(
          (project) =>
            project &&
            typeof project.password === "string" &&
            project.password.length > 0 &&
            typeof project.title === "string" &&
            project.title.trim() &&
            isDriveFileId(project.coverFileId),
        )
        .map((project) => ({ ...project, folder: getFolder(project) }))
        .filter((project) => project.folder)
    : [];

  if (!configuredProjects.length) {
    passwordInput.disabled = true;
    submitButton.disabled = true;
    status.textContent = "No private projects are currently available.";
    return;
  }

  async function listDriveImages(folderId) {
    const files = [];
    let pageToken = "";

    do {
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set("key", config.apiKey);
      url.searchParams.set("q", `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`);
      url.searchParams.set("pageSize", "1000");
      url.searchParams.set("orderBy", "name");
      url.searchParams.set("fields", "nextPageToken,files(id,name,webViewLink)");
      url.searchParams.set("supportsAllDrives", "true");
      url.searchParams.set("includeItemsFromAllDrives", "true");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "Google Drive rejected the request. Check the API key restrictions, Drive API enablement, and folder sharing."
            : `Google Drive returned an error (${response.status}).`,
        );
      }

      const result = await response.json();
      files.push(...(result.files || []));
      pageToken = result.nextPageToken || "";
    } while (pageToken);

    return files.filter((file) => file.id && file.name).sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderDriveImage(file, projectTitle) {
    const figure = document.createElement("figure");
    figure.className = "drive-photo";

    const button = document.createElement("button");
    button.className = "drive-photo-button";
    button.type = "button";
    button.dataset.fileId = file.id;
    button.dataset.fileName = file.name;
    button.dataset.driveUrl = file.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`;

    const image = document.createElement("img");
    image.src = driveThumbnail(file.id);
    const photoName = file.name.replace(/\.[^.]+$/, "");
    image.alt = `${projectTitle} project photo: ${photoName}, by Carson Dibb (carsondibb.com).`;
    image.loading = "lazy";
    image.decoding = "async";

    const caption = document.createElement("figcaption");
    caption.textContent = photoName;

    button.append(image, caption);
    figure.append(button);
    return figure;
  }

  function setupLightbox() {
    const image = dialog.querySelector("[data-lightbox-image]");
    const caption = dialog.querySelector("[data-lightbox-caption]");
    const driveLink = dialog.querySelector("[data-lightbox-drive]");

    photoGrid.addEventListener("click", (event) => {
      const button = event.target.closest(".drive-photo-button");
      if (!button) return;

      image.src = driveThumbnail(button.dataset.fileId, 2000);
      image.alt = button.querySelector("img").alt;
      caption.textContent = image.alt;
      driveLink.href = button.dataset.driveUrl;
      dialog.showModal();
    });

    dialog.querySelector("[data-lightbox-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => image.removeAttribute("src"));
  }

  async function openProject(project) {
    projectGate.hidden = true;
    projectGallery.hidden = false;
    galleryTitle.textContent = project.title;
    galleryDescription.textContent = project.description || "";
    cover.src = driveThumbnail(project.coverFileId);
    cover.alt = `${project.title} project cover, by Carson Dibb.`;
    folderLink.href = project.folder.url;
    document.querySelector("[data-private-project-breadcrumb]").textContent = project.title;
    document.title = `${project.title} | Private Project`;
    status.textContent = "";

    if (!config.apiKey) {
      galleryStatus.textContent =
        "Google Drive API key unavailable. Set the GOOGLE_DRIVE_API_KEY GitHub Actions secret and redeploy to load the gallery.";
      return;
    }

    try {
      galleryStatus.textContent = "Loading photos from Google Drive…";
      const files = await listDriveImages(project.folder.id);
      photoGrid.replaceChildren(...files.map((file) => renderDriveImage(file, project.title)));
      galleryStatus.textContent = files.length
        ? `${files.length} photo${files.length === 1 ? "" : "s"}`
        : "No images found. Make sure the image files are shared with anyone who has the link.";
    } catch (error) {
      galleryStatus.textContent = error instanceof Error ? error.message : "Unable to load this Google Drive folder.";
    }
  }

  setupLightbox();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const project = configuredProjects.find((item) => item.password === passwordInput.value);

    if (!project) {
      status.textContent = "That password did not match a private project.";
      passwordInput.select();
      return;
    }

    passwordInput.value = "";
    openProject(project);
  });
})();
