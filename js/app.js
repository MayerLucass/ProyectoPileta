const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  navLinks.classList.toggle('open', open);
});
navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navLinks.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}));
document.getElementById('year').textContent = new Date().getFullYear();
const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.remove('pending'); entry.target.classList.add('visible'); observer.unobserve(entry.target); } });
}, { threshold: .08 }) : null;
document.querySelectorAll('.reveal').forEach(el => { if (observer) { el.classList.add('pending'); observer.observe(el); } });
// Keep content accessible even if an observer callback never arrives.
setTimeout(() => document.querySelectorAll('.reveal.pending').forEach(el => el.classList.remove('pending')), 3000);

const gallery = document.getElementById('gallery');
const count = document.getElementById('work-count');
const dialog = document.getElementById('lightbox');
let projects = [];
let activeFilter = 'Todos';
function render() {
  gallery.replaceChildren();
  const selected = projects.filter(item => activeFilter === 'Todos' || item.category === activeFilter);
  count.textContent = `${projects.length} ${projects.length === 1 ? 'PROYECTO' : 'PROYECTOS'}`;
  if (!selected.length) {
    const message = document.createElement('p'); message.className = 'gallery-empty';
    message.textContent = 'Todavía no hay trabajos en esta categoría.'; gallery.append(message); return;
  }
  selected.forEach((item, index) => {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'work-card';
    card.setAttribute('aria-label', `Ver foto: ${item.title}`);
    const img = document.createElement('img');
    img.alt = item.title; img.loading = 'lazy'; img.decoding = 'async';
    if (item.thumbnail) {
      img.srcset = `${item.thumbnail} 480w, ${item.image} ${item.imageWidth || 960}w`;
      img.sizes = index % 5 === 0 ? '(max-width: 680px) 100vw, 65vw' : '(max-width: 680px) 50vw, 33vw';
    }
    img.addEventListener('error', () => {
      img.removeAttribute('srcset');
      if (img.getAttribute('src') !== item.image) img.src = item.image;
      else { img.hidden = true; card.setAttribute('aria-label', `${item.title}: foto no disponible`); }
    });
    img.src = item.thumbnail || item.image;
    const info = document.createElement('span'); info.className = 'work-info';
    const label = document.createElement('small'); label.textContent = item.category;
    const title = document.createElement('strong'); title.textContent = item.title;
    const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
    info.append(label, title, arrow); card.append(img, info);
    card.addEventListener('click', () => {
      dialog.querySelector('img').src = item.fullImage || item.image;
      dialog.querySelector('img').alt = item.title;
      dialog.querySelector('.lightbox-caption').textContent = `${item.title} — ${item.description || item.category}`;
      dialog.showModal();
    });
    gallery.append(card);
  });
}
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  render();
}));
fetch('data/projects.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw Error('No se pudo cargar'); return r.json(); }).then(data => { projects = Array.isArray(data) ? data : []; render(); }).catch(() => { count.textContent = 'Trabajos'; gallery.textContent = 'No pudimos cargar los trabajos. Volvé a intentar en unos minutos.'; });
dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
document.getElementById('contact-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const msg = `Hola, quisiera solicitar información.\n\nNombre: ${data.get('nombre')}\nTeléfono: ${data.get('telefono')}\nServicio: ${data.get('servicio')}\nConsulta: ${data.get('mensaje') || 'Sin comentarios'}`;
  window.open(`https://wa.me/5493562410512?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
});
