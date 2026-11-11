(() => {
  const config = window.ARCHIVE_CONFIG;
  const status = document.querySelector("[data-archive-status]");
  const projectList = document.querySelector("[data-project-list]");
  const gallery = document.querySelector("[data-drive-gallery]");

  if (!config || !Array.isArray(config.projects)) {
    setStatus("Archive setup is incomplete: configure archive-projects.js.");
    return;
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function escapeText(value) {
    return typeof value === "string" ? value : "";
  }

  function driveThumbnail(fileId, size = 1200) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
  }

  function parseFolderId(folderUrl) {
    let url;
    try {
      url = new URL(folderUrl);
    } catch {
      return null;
    }

    if (url.protocol !== "https:" || !["drive.google.com", "www.drive.google.com"].includes(url.hostname)) {
      return null;
    }

    const pathMatch = url.pathname.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    if (pathMatch) return pathMatch[1];

    const queryId = url.searchParams.get("id");
    return queryId && /^[a-zA-Z0-9_-]+$/.test(queryId) ? queryId : null;
  }

  function getPublicProjects() {
    return config.projects.filter(
      (project) =>
        project &&
        project.access === "public" &&
        /^[a-z0-9-]+$/.test(project.slug || "") &&
        escapeText(project.title).trim() &&
        parseFolderId(project.folderUrl),
    );
  }

  function makeProjectCard(project) {
    const link = document.createElement("a");
    link.className = "project-card";
    link.href = `archive-project.html?project=${encodeURIComponent(project.slug)}`;

    if (project.coverFileId && /^[a-zA-Z0-9_-]+$/.test(project.coverFileId)) {
      const image = document.createElement("img");
      image.src = driveThumbnail(project.coverFileId, 900);
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      link.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "project-card-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      link.append(placeholder);
    }

    const copy = document.createElement("div");
    copy.className = "project-card-copy";
    const title = document.createElement("h2");
    title.textContent = project.title;
    const description = document.createElement("p");
    description.textContent = project.description || "Open this project to browse its photos.";
    copy.append(title, description);
    link.append(copy);
    return link;
  }

  async function loadProjectList() {
    const projects = getPublicProjects();
    projectList.replaceChildren(...projects.map(makeProjectCard));
    setStatus(
      projects.length
        ? `${projects.length} public project${projects.length === 1 ? "" : "s"}`
        : "No public projects yet. Add one to archive-projects.js and publish the site.",
    );
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
      url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,webViewLink)");
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

  function renderDriveImage(file) {
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
    image.alt = file.name.replace(/\.[^.]+$/, "");
    image.loading = "lazy";
    image.decoding = "async";

    const caption = document.createElement("figcaption");
    caption.textContent = file.name.replace(/\.[^.]+$/, "");

    button.append(image, caption);
    figure.append(button);
    return figure;
  }

  async function loadProjectGallery() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("project");
    const project = getPublicProjects().find((item) => item.slug === slug);

    if (!project) {
      document.querySelector("[data-project-title]").textContent = "Project not found";
      setStatus("This project is unavailable or is not configured as public.");
      return;
    }

    document.title = `${project.title} | Carson Dibb Archive`;
    document.querySelector("[data-project-title]").textContent = project.title;
    document.querySelector("[data-project-description]").textContent = project.description || "";
    document.querySelector("[data-project-breadcrumb]").textContent = project.title;
    const canonicalUrl = new URL(window.location.href);
    canonicalUrl.search = new URLSearchParams({ project: project.slug }).toString();
    canonicalUrl.hash = "";
    document.querySelector('link[rel="canonical"]').href = canonicalUrl.href;
    document.querySelector('meta[name="description"]').content =
      project.description || `Browse photos from ${project.title} by Carson Dibb.`;
    document.querySelector('meta[property="og:title"]').content = document.title;
    document.querySelector('meta[property="og:description"]').content =
      project.description || `Browse photos from ${project.title} by Carson Dibb.`;
    document.querySelector('meta[name="twitter:title"]').content = document.title;
    document.querySelector('meta[name="twitter:description"]').content =
      project.description || `Browse photos from ${project.title} by Carson Dibb.`;

    if (!config.apiKey || config.apiKey === "YOUR_RESTRICTED_GOOGLE_DRIVE_API_KEY") {
      setStatus(
        "Google Drive API key unavailable. Set the GOOGLE_DRIVE_API_KEY GitHub Actions secret and redeploy the site.",
      );
      return;
    }

    const folderId = parseFolderId(project.folderUrl);
    if (!folderId) {
      setStatus("This project has an invalid Google Drive folder URL.");
      return;
    }

    try {
      setStatus("Loading photos from Google Drive…");
      const files = await listDriveImages(folderId);
      gallery.replaceChildren(...files.map(renderDriveImage));
      setStatus(
        files.length
          ? `${files.length} photo${files.length === 1 ? "" : "s"}`
          : "No images found. Make sure the image files are shared with anyone who has the link.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load this Google Drive folder.");
    }
  }

  function setupLightbox() {
    const dialog = document.querySelector("[data-lightbox]");
    if (!dialog) return;

    const image = dialog.querySelector("[data-lightbox-image]");
    const caption = dialog.querySelector("[data-lightbox-caption]");
    const driveLink = dialog.querySelector("[data-lightbox-drive]");

    gallery.addEventListener("click", (event) => {
      const button = event.target.closest(".drive-photo-button");
      if (!button) return;

      image.src = driveThumbnail(button.dataset.fileId, 2000);
      image.alt = button.dataset.fileName.replace(/\.[^.]+$/, "");
      caption.textContent = image.alt;
      driveLink.href = button.dataset.driveUrl;
      dialog.showModal();
    });

    dialog.querySelector("[data-lightbox-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      image.removeAttribute("src");
    });
  }

  if (projectList) {
    loadProjectList();
  } else if (gallery) {
    setupLightbox();
    loadProjectGallery();
  }
})();
