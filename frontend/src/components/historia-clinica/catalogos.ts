export interface CatGroup {
  titulo: string
  grupos: Record<string, ([string, number] | string)[]>
}

export const CAT: Record<string, CatGroup> = {
  antOc: {
    titulo: 'Antecedentes oculares',
    grupos: {
      'Refractivos': [
        ['Miopía', 0], ['Hipermetropía', 0], ['Astigmatismo', 0], ['Presbicia', 0], ['Anisometropía', 0],
        ['Miopía patológica', 1], ['Ambliopía', 0], ['Estrabismo', 0]
      ],
      'Párpados y superficie': [
        ['Ojo seco', 1], ['Blefaritis / DGM', 0], ['Demodex', 0], ['Chalazión a repetición', 0],
        ['Alergia ocular', 0], ['Queratoconjuntivitis vernal', 1], ['Pterigión', 0]
      ],
      'Córnea': [
        ['Queratocono', 1], ['Sospecha de queratocono', 1], ['Degeneración marginal pelúcida', 1],
        ['Ectasia post-LASIK', 1], ['Distrofia de Fuchs', 1], ['Otra distrofia corneal', 1], ['Leucoma', 1],
        ['Queratitis previa', 1], ['Herpes simple ocular', 1], ['Herpes zóster oftálmico', 1]
      ],
      'Cristalino': [
        ['Catarata', 0], ['Pseudofaquia', 0], ['Afaquia', 1], ['Subluxación de cristalino', 1]
      ],
      'Glaucoma y presión': [
        ['Glaucoma', 1], ['Hipertensión ocular', 1], ['Sospecha de glaucoma', 1], ['Glaucoma agudo previo', 1]
      ],
      'Retina y vítreo': [
        ['DMAE', 1], ['Retinopatía diabética', 1], ['Trombosis venosa retiniana', 1],
        ['Oclusión arterial retiniana', 1], ['Membrana epirretiniana', 1], ['Agujero macular', 1],
        ['Desprendimiento de retina', 1], ['Desgarro / degeneración periférica', 1], ['Retinosis pigmentaria', 1]
      ],
      'Nervio óptico': [
        ['Neuropatía óptica', 1], ['NAION', 1], ['Papiledema previo', 1]
      ],
      'Uveítis e inflamación': [
        ['Uveítis', 1], ['Escleritis / epiescleritis', 1]
      ],
      'Cirugía refractiva previa': [
        ['PRK', 1], ['LASIK', 1], ['Queratotomía radiada (KR)', 1], ['ICL', 1],
        ['Cirugía refractiva previa (sin especificar)', 1]
      ],
      'Cirugía de catarata previa': [
        ['Faco + monofocal', 0], ['Faco + monofocal tórico', 0], ['Faco + EDOF', 0],
        ['Faco + trifocal', 0], ['Faco + multifocal', 0], ['Cirugía de catarata previa (sin especificar)', 0],
        ['Capsulotomía YAG', 0]
      ],
      'Cirugía corneal previa': [
        ['Crosslinking (CXL)', 0], ['CXL plus', 0], ['Anillos intraestromales', 0],
        ['Queratoplastia lamelar (DALK)', 1], ['Queratoplastia penetrante', 1], ['Trasplante endotelial (DSAEK / DMEK)', 1]
      ],
      'Otras cirugías previas': [
        ['Cirugía de retina / vítrea', 1], ['Cirugía filtrante / glaucoma', 1],
        ['Cirugía de estrabismo', 0], ['Pterigión operado', 0]
      ],
      'Otros': [
        ['Trauma ocular', 1], ['Ojo único funcional', 1], ['Frotamiento ocular', 1]
      ]
    }
  },
  antGr: {
    titulo: 'Antecedentes generales',
    grupos: {
      'Metabólicos y vasculares': [
        ['Diabetes', 1], ['Hipertensión arterial', 0], ['Tiroidopatía', 1], ['Cardiopatía', 0], ['Apnea del sueño', 0]
      ],
      'Inmunológicos': [
        ['Enfermedad autoinmune / colagenopatía', 1], ['Inmunosupresión', 1], ['Atopía / rinitis', 0]
      ],
      'Otros': [
        ['Embarazo / lactancia', 1], ['Queloides', 1], ['Marfan / Ehlers-Danlos', 1], ['Síndrome de Down', 1],
        ['Tabaquismo', 0], ['Migraña', 0], ['Claustrofobia / ansiedad', 0]
      ]
    }
  },
  medic: {
    titulo: 'Medicación habitual',
    grupos: {
      'Riesgo quirúrgico directo': [
        ['Topiramato', 1], ['Tamsulosina', 1], ['Otro alfa-bloqueante (alfuzosina, doxazosina, terazosina)', 1],
        ['Isotretinoína', 1], ['Corticoides crónicos', 1], ['Anticoagulados', 1], ['Antiagregantes', 1], ['Inmunosupresores', 1]
      ],
      'Afectan la superficie ocular': [
        ['Antihistamínicos', 1], ['ISRS / antidepresivos', 1], ['Antidepresivos tricíclicos', 1],
        ['Anticonceptivos orales', 1], ['Terapia hormonal de reemplazo', 1], ['Betabloqueantes sistémicos', 1],
        ['Diuréticos', 0], ['Retinoides tópicos', 0]
      ],
      'Toxicidad retiniana u óptica': [
        ['Hidroxicloroquina / cloroquina', 1], ['Amiodarona', 1], ['Tamoxifeno', 1],
        ['Etambutol', 1], ['Sildenafil / inhibidores PDE5', 1], ['Bifosfonatos', 1], ['Interferón', 1]
      ],
      'Oftalmológica actual': [
        ['Lágrimas / lubricantes', 0], ['Antialérgico tópico', 0], ['Corticoide tópico', 1],
        ['Hipotensor ocular', 1], ['Ciclosporina tópica', 0], ['Antibiótico tópico', 0]
      ]
    }
  },
  complic: {
    titulo: 'Complicaciones postoperatorias',
    grupos: {
      'Córnea': [
        ['Haze', 1], ['DLK', 1], ['Estrías del flap', 1], ['Epitelización de interfase', 1], ['Defecto epitelial persistente', 1],
        ['Edema corneal', 1], ['Queratitis infecciosa', 1], ['Ojo seco severo', 0], ['Extrusión de anillo', 1], ['Melting', 1]
      ],
      'Presión y cámara': [
        ['Hipertensión ocular', 1], ['Hipotonía', 1], ['Seidel positivo', 1], ['Cámara plana', 1], ['Bloqueo pupilar', 1]
      ],
      'Cristalino / LIO': [
        ['Opacidad de cápsula posterior', 0], ['LIO descentrada', 1], ['Captura pupilar', 1], ['Ruptura capsular', 1],
        ['Restos corticales', 0], ['Vault inadecuado (ICL)', 1]
      ],
      'Retina y otros': [
        ['Edema macular cistoide', 1], ['Desprendimiento de retina', 1], ['Endoftalmitis', 1],
        ['Hemorragia', 1], ['Uveítis anterior', 1], ['Sin complicaciones', 0]
      ]
    }
  },
  explico: {
    titulo: 'Explico al paciente',
    grupos: {
      'Conversado con el paciente': [
        'Riesgos y beneficios', 'Alternativas terapéuticas', 'Halos y glare nocturnos',
        'Ojo seco postoperatorio', 'Anteojos residuales', 'Posible progresión del queratocono', 'Retoque / reintervención',
        'Presbicia y su evolución', 'Tiempos de recuperación',
        'Posible necesidad de trasplante endotelial', 'Posible cirugía de retina', 'Riesgo de desprendimiento de retina'
      ]
    }
  },
  valores: {
    titulo: 'Pasar valores de',
    grupos: {
      'Catarata': [
        'Faco + monofocal básico', 'Faco + monofocal plus', 'Faco + Clareon', 'Faco + Clareon tórico',
        'Faco + multifocal', 'Facorrefractiva + multifocal'
      ],
      'Refractiva': [
        'Refractiva convencional', 'Refractiva personalizada', 'Llega a las dioptrías', 'No llega a las dioptrías'
      ],
      'Queratocono': [
        'Anillos', 'CXL'
      ],
      'Ojo': [
        'AO', 'OD', 'OI'
      ]
    }
  }
}

export const VIDEOS_ESP = [
  { k: 'esp_miopia40', t: 'Cirugía refractiva en miopía cerca de los 40' },
  { k: 'esp_fuchs', t: 'Cataratas con distrofia de Fuchs' },
  { k: 'esp_glaucoma', t: 'Cataratas en paciente con glaucoma' },
  { k: 'esp_retina', t: 'Cataratas con problemas de retina' },
  { k: 'esp_trifocal', t: 'Facorrefractiva con lentes trifocales' }
]

export const VIDEOS = [
  { k: 'lio', t: 'Elección de LIO' },
  { k: 'catarata', t: 'Hablemos de cataratas' },
  { k: 'querato', t: 'Hablemos de queratocono' },
  { k: 'refractiva', t: 'Hablemos sobre cirugía refractiva' },
  { k: 'postop', t: 'Postoperatorio inmediato' },
  { k: 'ind_prk', t: 'Indicaciones PRK' },
  { k: 'ind_lasik', t: 'Indicaciones LASIK' },
  { k: 'ind_cxl', t: 'Indicaciones CXL' },
  { k: 'ind_cxlp', t: 'Indicaciones CXL plus' },
  { k: 'ind_faco', t: 'Indicaciones faco' },
  { k: 'ind_anillos', t: 'Indicaciones anillos' },
  { k: 'ind_lc', t: 'Indicaciones lentes de contacto' }
]

export const ALL_VIDEOS = [...VIDEOS, ...VIDEOS_ESP]

export const TXT_EXPLICO: Record<string, string> = {
  'Riesgos y beneficios': 'Conversamos sobre los beneficios que podés esperar y también sobre los riesgos. Ninguna cirugía está libre de complicaciones, y me importa que decidas conociendo las dos caras.',
  'Alternativas terapéuticas': 'Repasamos las alternativas al tratamiento propuesto, incluida la opción de seguir como estás, para que puedas comparar antes de decidir.',
  'Halos y glare nocturnos': 'Te expliqué que es frecuente ver halos o destellos alrededor de las luces, sobre todo de noche y al manejar. Suelen disminuir con los meses, aunque en algunos casos persisten.',
  'Ojo seco postoperatorio': 'Es esperable que los ojos queden más secos durante las primeras semanas o meses. Se trata con lágrimas artificiales y en general mejora, pero conviene saberlo de antemano.',
  'Anteojos residuales': 'Te aclaré que el objetivo es reducir la dependencia de los anteojos, no garantizar que nunca más los necesites. Puede quedar una graduación pequeña o hacer falta anteojos para algunas tareas puntuales.',
  'Posible progresión del queratocono': 'Hablamos de que el queratocono puede seguir avanzando con el tiempo. Por eso los controles periódicos son importantes aunque estés viendo bien.',
  'Retoque / reintervención': 'Te comenté que en algunos casos hace falta un retoque posterior para afinar el resultado.',
  'Presbicia y su evolución': 'Conversamos sobre la presbicia, la vista cansada que aparece con los años y que sigue cambiando con el tiempo, y cómo influye en la elección del tratamiento.',
  'Tiempos de recuperación': 'Repasamos los tiempos de recuperación y cuántos días vas a necesitar de reposo relativo antes de volver a tu actividad habitual.',
  'Posible necesidad de trasplante endotelial': 'Te expliqué que, por las características de tu córnea, existe la posibilidad de que más adelante necesites un trasplante de la capa interna de la córnea.',
  'Posible cirugía de retina': 'Hablamos de que podría llegar a hacer falta una cirugía de retina en el futuro.',
  'Riesgo de desprendimiento de retina': 'Te expliqué que existe riesgo de desprendimiento de retina y cuáles son los síntomas de alarma: destellos de luz, moscas volantes que aparecen de golpe, o una sombra que avanza en el campo visual. Ante cualquiera de estos, consultá de inmediato.'
}

export const TXT_CONDUCTA: Record<string, string> = {
  'Observación / control': 'Por ahora no hace falta ningún tratamiento: seguimos controlando la evolución.',
  'Todavía no operar': 'Decidimos no operar por el momento y volver a evaluarlo más adelante.',
  'LASIK': 'La conducta propuesta es una cirugía refractiva con técnica LASIK.',
  'PRK': 'La conducta propuesta es una cirugía refractiva con técnica PRK, de superficie.',
  'Cirugía refractiva a definir': 'Vamos a hacer una cirugía refractiva; la técnica exacta la definimos con los estudios.',
  'ICL': 'La conducta propuesta es el implante de una lente ICL dentro del ojo, conservando tu cristalino.',
  'ICL tórico': 'La conducta propuesta es el implante de una lente ICL tórica, que además corrige el astigmatismo.',
  'Crosslinking': 'La conducta propuesta es un crosslinking corneal, cuyo objetivo es frenar el avance del queratocono.',
  'CXL plus': 'La conducta propuesta es un crosslinking combinado, que además de frenar el avance busca mejorar algo la visión.',
  'Anillos intraestromales': 'La conducta propuesta es el implante de anillos intraestromales para regularizar la córnea.',
  'Anillos + CXL': 'La conducta propuesta es implantar anillos y hacer crosslinking, para regularizar la córnea y frenar el avance.',
  'Adaptación de LC': 'La conducta propuesta es adaptar lentes de contacto.',
  'Tratar superficie ocular primero': 'Antes de avanzar con cualquier cirugía vamos a tratar la superficie del ojo, porque de eso depende buena parte del resultado.',
  'Queratoplastia lamelar (DALK)': 'La conducta propuesta es un trasplante lamelar de córnea.',
  'Queratoplastia penetrante': 'La conducta propuesta es un trasplante de córnea.',
  'Trasplante endotelial (DSAEK / DMEK)': 'La conducta propuesta es un trasplante de la capa interna de la córnea.',
  'Capsulotomía YAG': 'La conducta propuesta es una capsulotomía con láser YAG, un procedimiento breve y ambulatorio.',
  'Retoque': 'La conducta propuesta es un retoque para afinar el resultado.',
  'No candidato': 'Por las características de tus ojos, hoy no sos candidata/o a la cirugía.'
}

export function txtConducta(c?: string): string {
  if (!c) return ''
  if (TXT_CONDUCTA[c]) return TXT_CONDUCTA[c]
  if (/^Faco/.test(c)) {
    return 'La conducta propuesta es una cirugía de catarata con implante de lente intraocular (' + c.replace(/^Faco \+ /, '') + ').'
  }
  if (/^Cirugía facorrefractiva/.test(c)) {
    return 'La conducta propuesta es una cirugía facorrefractiva, que reemplaza el cristalino por una lente para reducir la dependencia de los anteojos.'
  }
  return 'La conducta propuesta es: ' + c + '.'
}

export const MOTIVOS = [
  'Quiere liberarse de los lentes',
  'Control',
  'Quiere operarse de cataratas',
  'Presbicia',
  'Control de queratocono',
  'Disminución de agudeza visual',
  'Quiere operarse de queratocono',
  'Segunda opinión',
  'Le dijeron que tiene queratocono',
  'Quiere mejorar su visión'
]

export const USO_LENTES = [
  'Todo el día',
  'Todo el día, se los saca para leer',
  'Solo para lejos (manejar, TV, cine)',
  'Solo para cerca (leer, computadora)',
  'Solo para trabajar',
  'Ocasionalmente',
  'No los usa nunca'
]

export const CATARATA = [
  'No', 'Incipiente', 'N1', 'N2', 'N3', 'N4',
  'Cortical', 'Subcapsular posterior', 'Mixta', 'Blanca / madura', 'Pseudofaquia'
]

export const CIRUGIAS = [
  'LASIK', 'PRK', 'Cirugía refractiva a definir', 'ICL', 'ICL tórico',
  'Faco + lente a definir', 'Faco + monofocal básico', 'Faco + monofocal tórico', 'Faco + EDOF', 'Faco + trifocal',
  'Faco + multifocal a definir', 'Cirugía facorrefractiva', 'Crosslinking', 'CXL plus', 'Anillos intraestromales',
  'Anillos + CXL', 'Queratoplastia lamelar (DALK)', 'Queratoplastia penetrante', 'Trasplante endotelial (DSAEK / DMEK)',
  'Capsulotomía YAG', 'Retoque'
]

export const CONDUCTAS = [
  'Observación / control', 'Todavía no operar',
  ...CIRUGIAS.filter(c => c !== 'Retoque' && c !== 'Capsulotomía YAG'),
  'Capsulotomía YAG', 'Retoque', 'Adaptación de LC', 'Tratar superficie ocular primero', 'No candidato'
]

export const AV_LEJOS = [
  '20/15', '20/20', '20/25', '20/30', '20/40', '20/50', '20/60', '20/70', '20/80', '20/100', '20/150', '20/200',
  '20/400', 'Cuenta dedos', 'Movimiento de manos', 'Percepción luminosa', 'No percibe luz'
]

export const AV_CERCA = [
  'J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8', 'J9', 'J10', 'J11', 'J12', 'J14', 'J16', '> J16'
]

export const TIPOS_ESTUDIO = [
  'Pentacam / Tomografía corneal', 'Topografía corneal', 'Topografía epitelial', 'OCT macular',
  'OCT de nervio óptico', 'OCT de segmento anterior', 'Biometría', 'Recuento endotelial', 'Aberrometría',
  'Biomecánica corneal (ORA / Corvis)', 'Campo visual', 'Retinografía', 'Ecografía modo B', 'UBM', 'Meibografía', 'Laboratorio', 'Otro'
]

export const MEDS = [
  'Lágrimas artificiales', 'Hialuronato de sodio 0.15%', 'Carboximetilcelulosa 0.5%', 'Gel lubricante nocturno',
  'Ciclosporina 0.05%', 'Olopatadina 0.1%', 'Ketotifeno', 'Prednisolona acetato 1%', 'Loteprednol 0.5%', 'Fluorometolona 0.1%',
  'Dexametasona', 'Moxifloxacina 0.5%', 'Ofloxacina 0.3%', 'Tobramicina', 'Ciprofloxacina', 'Gatifloxacina',
  'Diclofenac 0.1%', 'Ketorolac 0.4%', 'Nepafenaco 0.1%', 'Timolol 0.5%', 'Dorzolamida 2%', 'Brimonidina 0.2%',
  'Latanoprost 0.005%', 'Bimatoprost 0.01%', 'Brinzolamida 1%', 'Dorzolamida + timolol', 'Brimonidina + timolol',
  'Aciclovir ungüento 3%', 'Valaciclovir 500 mg comprimidos', 'Doxiciclina 100 mg comprimidos',
  'Acetazolamida 250 mg comprimidos', 'Suero autólogo', 'Vitamina A ungüento', 'Higiene palpebral'
]

export const POSOL = [
  '1 gota cada 2 horas', '1 gota cada 4 horas', '1 gota cada 6 horas', '1 gota cada 8 horas',
  '1 gota cada 12 horas', '1 gota por día', '1 gota por día a la noche', '4 veces por día durante 1 semana',
  '4 veces por día y descender 1 gota por semana', 'Aplicar a la noche', '1 comprimido por día', '1 comprimido cada 12 horas'
]

export const ESTUDIOS = [
  { t: 'Topografía corneal ORBSCAN' },
  { t: 'Paquimetría corneal ultrasónica' },
  { t: 'CVC (campo visual computarizado)', rx: true },
  { t: 'Ecografía' },
  { t: 'UBM' },
  { t: 'OCT', sub: ['papilar y macular', 'de cámara anterior', 'con mapa epitelial'] },
  { t: 'AngioOCT' },
  { t: 'Optomap' },
  { t: 'Microscopía especular' },
  { t: 'Biometría óptica con cálculo de lente intraocular' },
  { t: 'Aberrometría' },
  { t: 'HD Analyzer', rx: true },
  { t: 'Meibografía' },
  { t: 'Estudio sensoriomotor' },
  { t: 'Electrocardiograma y riesgo quirúrgico' },
  { t: 'Análisis de sangre' }
]

export const PRESETS: Record<string, { titulo: string; dx: string; ordenes: string[] }> = {
  catarata: {
    titulo: 'Catarata',
    dx: 'Catarata',
    ordenes: [
      'Topografía corneal ORBSCAN y paquimetría',
      'OCT',
      'Microscopía especular',
      'HD Analyzer',
      'Biometría y cálculo de lente intraocular'
    ]
  },
  faco: {
    titulo: 'Facorrefractiva',
    dx: 'Facorrefractiva',
    ordenes: [
      'Topografía corneal ORBSCAN y paquimetría',
      'OCT',
      'Microscopía especular',
      'HD Analyzer',
      'Biometría y cálculo de lente intraocular'
    ]
  },
  laser: {
    titulo: 'Refractiva láser',
    dx: 'Miopía / astigmatismo / hipermetropía',
    ordenes: [
      'Topografía corneal ORBSCAN y paquimetría',
      'OCT con mapa epitelial',
      'Aberrometría'
    ]
  },
  querato: {
    titulo: 'Queratocono',
    dx: 'Queratocono',
    ordenes: [
      'Topografía corneal ORBSCAN y paquimetría',
      'OCT con mapa epitelial',
      'Microscopía especular',
      'Biometría y cálculo de lente intraocular'
    ]
  },
  icl: {
    titulo: 'ICL',
    dx: 'Miopía / astigmatismo / hipermetropía',
    ordenes: [
      'Topografía corneal ORBSCAN y paquimetría',
      'OCT con mapa epitelial y cámara anterior con medición de ángulos, ACD y lens rise',
      'Microscopía especular',
      'Biometría y cálculo de lente intraocular',
      'UBM'
    ]
  }
}


