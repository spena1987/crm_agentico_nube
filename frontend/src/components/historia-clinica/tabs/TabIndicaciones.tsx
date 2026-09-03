'use client'

import React, { useState } from 'react'
import { PacienteData } from '../types'
import { MessageSquare, Printer, BookOpen, AlertCircle } from 'lucide-react'

interface TabIndicacionesProps {
  paciente: PacienteData
  onImprimirTexto: (titulo: string, texto: string) => void
}

const GUIAS: Record<string, { titulo: string; contenido: string }> = {
  catarata_postop: {
    titulo: 'Cuidados Postoperatorios: Cirugía de Catarata',
    contenido: `CUIDADOS POSTOPERATORIOS DE CIRUGÍA DE CATARATA

1. MEDICACIÓN Y GOTAS:
- Iniciar las gotas recetadas según el esquema indicado por el profesional.
- Lavarse muy bien las manos con agua y jabón antes de colocarse cualquier colirio.
- Si tiene indicadas 2 o más gotas diferentes, espere 5 minutos entre cada una.
- NO suspenda la medicación habitual (presión, tiroides, etc.) salvo indicación contraria.

2. CUIDADOS DEL OJO:
- NO frotarse ni apretarse el ojo operado bajo ninguna circunstancia.
- Utilizar el protector ocular rígido o anteojos de sol durante el día y el protector al dormir durante la primera semana.
- Es normal sentir ligera sensación de arenilla o cuerpo extraño los primeros días.

3. ACTIVIDADES:
- Evitar esfuerzos físicos intensos, levantar pesos mayores a 5 kg y agacharse bruscamente.
- Puede leer, mirar televisión y utilizar el teléfono o computadora con moderación.
- Evitar que entre agua directa de la ducha, jabón o champú al ojo operado durante 7 días.
- No ingresar a piletas, mar, saunas o hidromasajes por al menos 3 semanas.

4. SIGNOS DE ALERTA (Consultar de urgencia):
- Dolor intenso que no cede con analgésicos comunes.
- Pérdida brusca o disminución marcada de la visión.
- Ojo muy rojo acompañado de secreción purulenta (pus).
- Náuseas o vómitos persistentes.`
  },
  lasik_postop: {
    titulo: 'Cuidados Postoperatorios: Cirugía Refractiva Láser (LASIK / PRK)',
    contenido: `CUIDADOS POSTOPERATORIOS DE CIRUGÍA REFRACTIVA LÁSER

1. LAS PRIMERAS 24 HORAS:
- Al llegar a su domicilio, descanse con los ojos cerrados en una habitación en penumbra.
- Es normal lagrimeo abundante, ardor y dificultad para abrir los ojos las primeras 4 a 6 horas.
- Duerma con los protectores oculares transparentes puestos durante las primeras 3 noches.

2. GOTAS Y LUBRICACIÓN:
- Aplique el colirio antibiótico/antiinflamatorio según la receta indicada.
- Aplique lágrimas artificiales frecuentemente (cada 1 o 2 horas) para acelerar la cicatrización.

3. PRECAUCIONES IMPORTANTES:
- NUNCA SE FROE LOS OJOS. Frotarse puede desplazar el flap corneal.
- Use gafas de sol con protección UV al salir a la calle.
- No maquillarse los ojos por al menos 10 a 14 días.
- No practicar deportes de contacto ni natación durante 30 días.`
  },
  cxl_postop: {
    titulo: 'Cuidados Postoperatorios: Crosslinking Corneal',
    contenido: `CUIDADOS POSTOPERATORIOS DE CROSSLINKING CORNEAL

1. LENTE DE CONTACTO TERAPÉUTICA:
- Lleva colocada una lente blanda que funciona como vendaje protector.
- NO intentar retirarla. Será removida por el oftalmólogo en el control (generalmente entre el día 4 y 7).
- Si la lente se cae sola, NO intente recolocarla; continúe con las gotas y avise al consultorio.

2. MANEJO DEL DOLOR Y MOLESTIAS:
- Es esperable dolor moderado a intenso y fotofobia durante las primeras 48 horas tras el procedimiento.
- Tome los analgésicos por vía oral indicados de forma reglada.
- Utilice compresas frías en la frente y párpados cerrados para alivio.

3. EVITAR FROTAMIENTO:
- ESTRICTAMENTE PROHIBIDO FROTARSE EL OJO.`
  },
  queratocono: {
    titulo: 'Recomendaciones Fundamentales en Queratocono',
    contenido: `RECOMENDACIONES PARA PACIENTES CON QUERATOCONO

REGLA NÚMERO 1: NO FROTARSE LOS OJOS
- Frotarse los ojos es la causa principal de la progresión y deformación de la córnea en el queratocono.
- Cada vez que se frota, debilita la estructura corneal y empeora el astigmatismo.
- Si siente picazón: aplique compresas frías sobre los párpados o instile lágrimas frías de heladera.
- Si tiene alergia ocular crónica, solicite a su oftalmólogo un colirio antialérgico específico.`
  },
  ojo_seco: {
    titulo: 'Tratamiento y Rutina para Ojo Seco y Meibomio',
    contenido: `RUTINA DE HIGIENE Y ALIVIO EN OJO SECO Y DISFUNCIÓN MEIBOMIANA

1. CALOR LOCAL:
- Aplicar compresas tibias o antifaz térmico sobre los párpados cerrados durante 5 a 10 minutos una o dos veces al día.
- El calor licúa los aceites estancados en las glándulas de los párpados.

2. MASAJE PALPEBRAL:
- Inmediatamente luego del calor, masajear suavemente con la yema del dedo el párpado superior hacia abajo y el inferior hacia arriba.

3. LUBRICACIÓN OCULAR:
- Utilizar lágrimas artificiales sin conservantes de forma regular.`
  }
}

export default function TabIndicaciones({
  paciente,
  onImprimirTexto
}: TabIndicacionesProps) {
  const [guiaKey, setGuiaKey] = useState('catarata_postop')
  const [textoEditado, setTextoEditado] = useState(GUIAS.catarata_postop.contenido)

  const handleSelectGuia = (key: string) => {
    setGuiaKey(key)
    setTextoEditado(GUIAS[key].contenido)
  }

  const enviarWhatsApp = () => {
    const rawTel = (paciente.telefono || '').replace(/\D/g, '')
    let fullTel = rawTel
    if (fullTel.startsWith('0')) fullTel = fullTel.slice(1)
    if (fullTel.startsWith('15')) fullTel = fullTel.slice(2)
    if (!fullTel.startsWith('54') && fullTel.length >= 10) fullTel = '549' + fullTel

    const mensaje = `*${GUIAS[guiaKey].titulo}*\nPaciente: ${paciente.nombre || ''}\n\n${textoEditado}`
    const url = `https://wa.me/${fullTel}?text=${encodeURIComponent(mensaje)}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-4 text-[#16323f]">
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#eef3f6]">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Hojas de Indicaciones para el Paciente
          </h2>
          <span className="text-[10px] text-[#728a99]">
            Instrucciones pre y postquirúrgicas personalizables
          </span>
        </div>

        {/* Selector de Guías */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[
            ['catarata_postop', 'Catarata Postop'],
            ['lasik_postop', 'Láser LASIK/PRK'],
            ['cxl_postop', 'Crosslinking CXL'],
            ['queratocono', 'Queratocono (No frotar)'],
            ['ojo_seco', 'Ojo Seco / Meibomio']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSelectGuia(key)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all border ${
                guiaKey === key
                  ? 'bg-[#0e7c86] text-white border-[#0e7c86] shadow-sm'
                  : 'bg-[#f7fafb] text-[#16323f] border-[#dde6ec] hover:border-[#0e7c86]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Editor de Texto de la Guía */}
        <div className="space-y-2">
          <textarea
            rows={14}
            value={textoEditado}
            onChange={e => setTextoEditado(e.target.value)}
            className="w-full border border-[#dde6ec] rounded-lg p-3 text-xs font-mono focus:border-[#0e7c86] outline-none leading-relaxed"
          />
        </div>

        {/* Acciones: Enviar por WhatsApp e Imprimir */}
        <div className="flex items-center justify-between pt-3 border-t border-[#eef3f6]">
          <div className="text-[11px] text-[#728a99] flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-[#0e7c86]" />
            Puede editar el texto libremente antes de imprimir o enviar por WhatsApp.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={enviarWhatsApp}
              className="px-3.5 py-1.5 bg-[#1a7f4b] hover:bg-[#136139] text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Enviar por WhatsApp
            </button>
            <button
              type="button"
              onClick={() => onImprimirTexto(GUIAS[guiaKey].titulo, textoEditado)}
              className="px-3.5 py-1.5 bg-[#0e7c86] hover:bg-[#0a636b] text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Indicaciones
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

