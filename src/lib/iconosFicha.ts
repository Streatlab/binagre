/* ==============================================================================
 * ICONOS DE LA FICHA TÉCNICA (paquete de diseño validado, 24-jul-2026)
 * SVG de trazo (stroke-width 1.5, viewBox 24×24, sin relleno) en `currentColor`:
 * se colorean con la propiedad `color` del contenedor y salen bien en B/N.
 * Se guardan inline (no como archivos sueltos) para que la hoja imprimible no
 * dependa de rutas públicas ni de que el navegador llegue a cargarlas.
 * ============================================================================== */

export const ICONOS_ALERGENOS: Record<string, string> = {
  gluten: '<path d="M12 21V8"></path><path d="M12 8c0-2.5 2-4.5 4.5-4.5C16.5 6 14.5 8 12 8Z"></path><path d="M12 8C12 5.5 10 3.5 7.5 3.5 7.5 6 9.5 8 12 8Z"></path><path d="M12 13c0-2.2 1.8-4 4-4 0 2.2-1.8 4-4 4Z"></path><path d="M12 13c0-2.2-1.8-4-4-4 0 2.2 1.8 4 4 4Z"></path><path d="M12 18c0-2.2 1.8-4 4-4 0 2.2-1.8 4-4 4Z"></path><path d="M12 18c0-2.2-1.8-4-4-4 0 2.2 1.8 4 4 4Z"></path>',
  lacteos: '<path d="M9 3h6l-.5 3.2 2.2 3.4c.2.3.3.7.3 1V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-9.4c0-.3.1-.7.3-1l2.2-3.4Z"></path><path d="M7.2 13h9.6"></path>',
  huevos: '<ellipse cx="12" cy="14" rx="6" ry="8"></ellipse>',
  soja: '<path d="M6 18c-2-4 1-9 5-11 3-1.5 6-1 7 1 1 2-1 4-3 5"></path><circle cx="9.5" cy="13" r="1.6"></circle><circle cx="13" cy="9.5" r="1.6"></circle><path d="M6 18c1.5 1.5 4 2 6 1"></path>',
  frutos_secos: '<path d="M12 3c3.5 2 5.5 5.5 5.5 9 0 4.5-2.5 8-5.5 9-3-1-5.5-4.5-5.5-9C6.5 8.5 8.5 5 12 3Z"></path><path d="M12 4v17"></path>',
  crustaceos: '<circle cx="12" cy="13" r="4"></circle><path d="M8 9 4 5"></path><path d="M16 9l4-4"></path><path d="M4 5l.5 3"></path><path d="M20 5l-.5 3"></path><path d="M9 17l-3 3"></path><path d="M15 17l3 3"></path><path d="M12 17v4"></path>',
  pescado: '<path d="M3 12c3-4 7-6 11-6 3 0 5 1.5 7 6-2 4.5-4 6-7 6-4 0-8-2-11-6Z"></path><circle cx="16.5" cy="11" r="0.8" fill="currentColor" stroke="none"></circle><path d="M3 12l3-3v6l-3-3Z"></path>',
  moluscos: '<path d="M12 20C7 20 3 16 3 11c0-1 .5-2 1.5-2S6 10 6 11c0-1.5 1-3 2.5-3S11 9.5 11 11c0-1.5 1-3 2.5-3S16 9.5 16 11c0-1 .5-2 1.5-2S21 10 21 11c0 5-4 9-9 9Z"></path>',
  cacahuetes: '<path d="M12 3c2.2 0 4 1.8 4 4 0 1.2-.5 2.2-1.2 3 .7.8 1.2 1.8 1.2 3v1c0 3.9-1.8 7-4 7s-4-3.1-4-7v-1c0-1.2.5-2.2 1.2-3C8.5 9.2 8 8.2 8 7c0-2.2 1.8-4 4-4Z"></path><path d="M8.8 10h6.4"></path>',
  apio: '<path d="M9 21c-1-4-1-9 0-14"></path><path d="M12 21c0-5 0-10 1-15"></path><path d="M15 21c1-4 1.5-8 1-12"></path><path d="M6 7c2-1 4-1 6 0"></path><path d="M12 6c2-1.5 4-1.5 6 0"></path>',
  mostaza: '<path d="M10 21V9a2 2 0 0 1 4 0v12"></path><path d="M9 9V6a3 3 0 0 1 6 0v3"></path><path d="M11 3h2"></path>',
  sesamo: '<ellipse cx="9" cy="9" rx="2" ry="3" transform="rotate(-20 9 9)"></ellipse><ellipse cx="15" cy="12" rx="2" ry="3" transform="rotate(15 15 12)"></ellipse><ellipse cx="10" cy="16" rx="2" ry="3" transform="rotate(-10 10 16)"></ellipse>',
  sulfitos: '<path d="M9 3h6v5a3 3 0 0 1-3 3 3 3 0 0 1-3-3V3Z"></path><path d="M12 11v7"></path><path d="M9 21h6"></path>',
  altramuces: '<path d="M12 21V10"></path><path d="M12 10c-2 0-3.5-1.5-3.5-3.5S10 3 12 3s3.5 1.5 3.5 3.5S14 10 12 10Z"></path><path d="M12 14c-2.5 0-4-1-4-1"></path><path d="M12 17c2.5 0 4-1 4-1"></path>',
}

export const ICONOS_CONSERVACION: Record<string, string> = {
  taper: '<path d="M5 8h14l-1 11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 8Z"></path><path d="M3.5 5.5h17V8h-17Z"></path>',
  biberon: '<path d="M10 3h4v2.5l1.5 2c.3.4.5.9.5 1.4V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8.9c0-.5.2-1 .5-1.4L10 5.5V3Z"></path><path d="M8.2 12h7.6"></path>',
  vacio: '<rect x="4" y="6" width="16" height="12" rx="1.5"></rect><path d="M8 6v12"></path><path d="M16 6v12"></path><path d="M4 12h16"></path>',
  congelacion: '<path d="M12 3v18"></path><path d="M3.6 7.5l16.8 9"></path><path d="M20.4 7.5l-16.8 9"></path><path d="M12 7l-2.5-2M12 7l2.5-2"></path><path d="M12 17l-2.5 2M12 17l2.5 2"></path>',
}

/** Los 14 alérgenos del Reg. UE 1169/2011, en el orden del documento. */
export const ALERGENOS_14: { k: string; nombre: string }[] = [
  { k: 'gluten', nombre: 'Gluten' },
  { k: 'lacteos', nombre: 'Lácteos' },
  { k: 'huevos', nombre: 'Huevos' },
  { k: 'soja', nombre: 'Soja' },
  { k: 'frutos_secos', nombre: 'Frutos secos' },
  { k: 'crustaceos', nombre: 'Crustáceos' },
  { k: 'pescado', nombre: 'Pescado' },
  { k: 'moluscos', nombre: 'Moluscos' },
  { k: 'cacahuetes', nombre: 'Cacahuetes' },
  { k: 'apio', nombre: 'Apio' },
  { k: 'mostaza', nombre: 'Mostaza' },
  { k: 'sesamo', nombre: 'Sésamo' },
]
export const ALERGENOS_2: { k: string; nombre: string }[] = [
  { k: 'sulfitos', nombre: 'Sulfitos' },
  { k: 'altramuces', nombre: 'Altramuces' },
]

/** Los 4 métodos de conservación del documento. */
export const CONSERVACION_4: { k: string; nombre: string }[] = [
  { k: 'taper', nombre: 'Táper' },
  { k: 'biberon', nombre: 'Biberón' },
  { k: 'vacio', nombre: 'Vacío' },
  { k: 'congelacion', nombre: 'Congelación' },
]
