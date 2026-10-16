(() => {
  const REPO = 'MayerLucass/ProyectoPileta';
  const API = `https://api.github.com/repos/${REPO}`;
  const FILE = 'data/projects.json';
  const $ = id => document.getElementById(id);
  let token = '';
  let projects = [];
  let fileSha = '';
  let editing = null;
  let busy = false;
  let previewUrl = '';

  function notice(message, error = false) { $('feedback').textContent = message; $('feedback').classList.toggle('error', error); }
  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
      cache: 'no-store'
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) throw Error('El token no es válido. Revisalo e intentá de nuevo.');
      if (response.status === 403) throw Error('Sin permiso para publicar. El token necesita Contents: Read and write en este repositorio.');
      if (response.status === 409) throw Error('Otro cambio se publicó al mismo tiempo. Recargá el panel y volvé a intentar.');
      throw Error(body.message || `Error de GitHub (${response.status}).`);
    }
    return body;
  }
  function decodeBase64(base64) {
    const bytes = Uint8Array.from(atob(base64.replace(/\s/g, '')), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  function encodeBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }
  async function load() {
    const response = await request(`/contents/${FILE}?ref=main`);
    fileSha = response.sha;
    const data = JSON.parse(decodeBase64(response.content));
    if (!Array.isArray(data)) throw Error('El archivo de proyectos no tiene el formato esperado.');
    projects = data;
    render();
  }
  function setBusy(value) {
    busy = value;
    $('save-button').disabled = value;
    $('save-button').textContent = value ? 'Publicando…' : editing ? 'Guardar cambios' : 'Publicar trabajo';
    $('logout').disabled = value;
  }
  async function publish(next, message) {
    const result = await request(`/contents/${FILE}`, {
      method: 'PUT', body: JSON.stringify({ message, content: encodeBase64(JSON.stringify(next, null, 2) + '\n'), sha: fileSha, branch: 'main' })
    });
    fileSha = result.content.sha;
    projects = next;
    render();
  }
  function render() {
    $('total').textContent = `(${projects.length})`;
    $('items').replaceChildren();
    if (!projects.length) { $('items').textContent = 'Todavía no hay trabajos publicados.'; return; }
    projects.forEach(item => {
      const row = document.createElement('div'); row.className = 'item';
      const image = document.createElement('img'); image.src = item.thumbnail || item.image; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      const content = document.createElement('div'); content.className = 'item-body';
      const title = document.createElement('strong'); title.textContent = item.title;
      const category = document.createElement('small'); category.textContent = item.category;
      const actions = document.createElement('div'); actions.className = 'item-actions';
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Editar';
      edit.onclick = () => {
        if (busy) return;
        editing = item.id;
        $('title').value = item.title;
        $('category').value = item.category;
        $('description').value = item.description || '';
        $('photo').value = '';
        showPreview(item.image);
        $('form-title').textContent = 'Editar trabajo';
        $('save-button').textContent = 'Guardar cambios';
        $('cancel-edit').hidden = false;
        $('project-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = 'Quitar';
      remove.onclick = async () => {
        if (busy || !confirm(`¿Quitar “${item.title}” de la galería?`)) return;
        setBusy(true); notice('Publicando cambio…');
        try { await publish(projects.filter(p => p.id !== item.id), `Quitar trabajo: ${item.title}`); if (editing === item.id) resetForm(); notice('Trabajo quitado de la galería. La actualización pública puede tardar unos minutos.'); }
        catch (error) { notice(error.message, true); }
        finally { setBusy(false); }
      };
      actions.append(edit, remove); content.append(title, category, actions); row.append(image, content); $('items').append(row);
    });
  }
  function showPreview(url) {
    if (previewUrl && previewUrl !== url) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
    $('preview').replaceChildren();
    if (url) { const image = document.createElement('img'); image.src = url; image.alt = 'Vista previa'; $('preview').append(image); }
    else $('preview').textContent = 'Vista previa de la foto';
  }
  function resetForm() {
    editing = null;
    $('project-form').reset();
    $('form-title').textContent = 'Agregar un trabajo';
    $('save-button').textContent = 'Publicar trabajo';
    $('cancel-edit').hidden = true;
    showPreview('');
  }
  function compress(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('No se pudo procesar la foto.')), 'image/webp', .80);
      };
      image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(Error('No se pudo abrir esta imagen. Probá con una foto JPG, PNG o WebP.')); };
      image.src = objectUrl;
    });
  }
  function blobBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(blob);
    });
  }
  $('photo').addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) { previewUrl = URL.createObjectURL(file); showPreview(previewUrl); }
    else showPreview(editing ? projects.find(p => p.id === editing)?.image : '');
  });
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault(); token = $('token').value.trim(); notice('Conectando…');
    try {
      await request('/contents/data/projects.json?ref=main');
      await load();
      $('token').value = '';
      $('login-section').hidden = true;
      $('workspace').hidden = false;
      $('connection-status').textContent = 'Conectado';
      $('connection-status').classList.add('connected');
      notice('Conectado. Ya podés administrar los trabajos.');
    } catch (error) { token = ''; notice(error.message, true); }
  });
  $('project-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const file = $('photo').files[0];
    if (!editing && !file) { notice('Seleccioná una foto para el trabajo.', true); return; }
    if (file && (file.size > 15 * 1024 * 1024 || !file.type.startsWith('image/'))) { notice('Elegí una imagen válida de hasta 15 MB.', true); return; }
    setBusy(true); notice('Preparando el trabajo…');
    try {
      const old = editing ? projects.find(p => p.id === editing) : null;
      if (editing && !old) throw Error('Este trabajo ya no existe. Recargá el panel.');
      let imagePath = old?.image || '';
      let fullImage = old?.fullImage || old?.image || '';
      if (file) {
        const image = await compress(file);
        const extension = image.type === 'image/webp' ? 'webp' : 'png';
        const name = `trabajos/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
        notice('Subiendo foto…');
        await request(`/contents/${name}`, { method: 'PUT', body: JSON.stringify({ message: `Agregar foto de trabajo`, content: await blobBase64(image), branch: 'main' }) });
        imagePath = name;
        const originalExtension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'image';
        const originalName = `trabajos/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-original.${originalExtension}`;
        notice('Guardando foto original…');
        await request(`/contents/${originalName}`, { method: 'PUT', body: JSON.stringify({ message: 'Conservar foto original del trabajo', content: await blobBase64(file), branch: 'main' }) });
        fullImage = originalName;
      }
      const entry = { id: old?.id || crypto.randomUUID(), title: $('title').value.trim(), category: $('category').value, description: $('description').value.trim(), image: imagePath, fullImage, ...(!file && old?.thumbnail ? { thumbnail: old.thumbnail, imageWidth: old.imageWidth } : {}) };
      notice('Publicando en la galería…');
      const next = old ? projects.map(item => item.id === editing ? entry : item) : [entry, ...projects];
      await publish(next, old ? `Actualizar trabajo: ${entry.title}` : `Publicar trabajo: ${entry.title}`);
      resetForm();
      notice('Trabajo publicado. Podés verlo en el sitio cuando GitHub Pages termine de actualizarse (puede tardar unos minutos).');
    } catch (error) { notice(`${error.message} ${file ? 'Si la foto llegó a subirse, volvé a guardar para completar la publicación.' : ''}`, true); }
    finally { setBusy(false); }
  });
  $('cancel-edit').addEventListener('click', resetForm);
  $('logout').addEventListener('click', () => { if (busy) return; token = ''; projects = []; fileSha = ''; resetForm(); $('workspace').hidden = true; $('login-section').hidden = false; $('connection-status').textContent = 'Sin conectar'; $('connection-status').classList.remove('connected'); notice('Sesión desconectada.'); });
})();
