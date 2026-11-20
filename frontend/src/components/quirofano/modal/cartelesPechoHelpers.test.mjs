import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  esValorPresente,
  formatearDniClinico,
  formatearFechaCirugia,
  requiereLenteSemantico,
  evaluarBloqueLio,
  obtenerClasePractica,
} from './cartelesPechoHelpers.ts'

describe('esValorPresente', () => {
  it('preserves numeric 0 and "0"', () => {
    assert.equal(esValorPresente(0), true)
    assert.equal(esValorPresente('0'), true)
  })

  it('rejects null, undefined, and whitespace strings', () => {
    assert.equal(esValorPresente(null), false)
    assert.equal(esValorPresente(undefined), false)
    assert.equal(esValorPresente(''), false)
    assert.equal(esValorPresente('   '), false)
  })
})

describe('formatearDniClinico', () => {
  it('strips leading zeros and formats with dots', () => {
    assert.equal(formatearDniClinico('0016038153'), '16.038.153')
    assert.equal(formatearDniClinico(32123456), '32.123.456')
  })

  it('returns S/D for empty or zero-only DNI', () => {
    assert.equal(formatearDniClinico(''), 'S/D')
    assert.equal(formatearDniClinico('000'), 'S/D')
    assert.equal(formatearDniClinico(null), 'S/D')
  })
})

describe('formatearFechaCirugia', () => {
  it('formats ISO date to DD/MM/YYYY', () => {
    assert.equal(formatearFechaCirugia('2026-11-20T14:30:00Z'), '20/11/2026')
    assert.equal(formatearFechaCirugia('2026-05-03'), '03/05/2026')
  })
})

describe('requiereLenteSemantico', () => {
  it('respects explicit llevaLente false even for cataract procedures', () => {
    assert.equal(requiereLenteSemantico('FACOEMULSIFICACION', false), false)
  })

  it('respects negation keywords when llevaLente is null/undefined', () => {
    assert.equal(requiereLenteSemantico('FACO SIN LIO', undefined), false)
    assert.equal(requiereLenteSemantico('EXPLANTE DE LENTE', null), false)
    assert.equal(requiereLenteSemantico('RETIRO DE LIO', null), false)
    assert.equal(requiereLenteSemantico('EXTRACCIÓN DE LIO', null), false)
    assert.equal(requiereLenteSemantico('CIRUGIA SIN LENTE', undefined), false)
  })

  it('detects IOL-requiring procedures when llevaLente is null/undefined', () => {
    assert.equal(requiereLenteSemantico('FACOEMULSIFICACION', null), true)
    assert.equal(requiereLenteSemantico('CIRUGIA DE CATARATA', undefined), true)
    assert.equal(requiereLenteSemantico('IMPLANTE ICL', undefined), true)
  })

  it('returns false for non-IOL procedures', () => {
    assert.equal(requiereLenteSemantico('VITRECTOMIA', null), false)
    assert.equal(requiereLenteSemantico('PTERIGION', undefined), false)
  })
})

describe('evaluarBloqueLio', () => {
  it('preserves 0 D diopter and 0° incision/toric axis separated from T value without loteTexto', () => {
    const res = evaluarBloqueLio({
      practica_nombre: 'FACO',
      lleva_lente: true,
      lente_tipo: 'MONOFOCAL',
      lente_dioptria: 0,
      lente_incision_grados: 0,
      lente_torico_valor: '2',
      lente_torico_eje: 0,
      lente_lote: 'L123',
    })
    assert.equal(res.estado, 'CARGADO')
    assert.equal(res.mostrarBloque, true)
    assert.equal(res.dioptriaTexto, '0 D')
    assert.equal(res.incisionTexto, '0°')
    assert.equal(res.toricoValorTexto, 'T2')
    assert.equal(res.toricoEjeTexto, '0°')
    assert.equal(res.tipoTexto, 'MONOFOCAL')
    assert.equal('loteTexto' in res, false)
  })

  it('shows S/D for diopter when only lente_tipo is loaded', () => {
    const res = evaluarBloqueLio({
      practica_nombre: 'FACO',
      lleva_lente: true,
      lente_tipo: 'ACRYSOF',
      lente_dioptria: null,
    })
    assert.equal(res.estado, 'CARGADO')
    assert.equal(res.dioptriaTexto, 'S/D')
  })

  it('returns toricoValorTexto without toricoEjeTexto when axis is absent', () => {
    const res = evaluarBloqueLio({
      practica_nombre: 'FACO',
      lleva_lente: true,
      lente_dioptria: '+21.5',
      lente_torico_valor: '4',
      lente_torico_eje: null,
    })
    assert.equal(res.toricoValorTexto, 'T4')
    assert.equal(res.toricoEjeTexto, null)
  })

  it('returns null for toricoEjeTexto when lente_torico_valor is absent', () => {
    const res = evaluarBloqueLio({
      practica_nombre: 'FACO',
      lleva_lente: true,
      lente_dioptria: '+21.5',
      lente_torico_valor: null,
      lente_torico_eje: 90,
    })
    assert.equal(res.toricoValorTexto, null)
    assert.equal(res.toricoEjeTexto, null)
  })

  it('returns NO_CALCULADA when procedure requires IOL and none is loaded', () => {
    const res = evaluarBloqueLio({
      practica_nombre: 'FACOEMULSIFICACION + LIO',
      lleva_lente: null,
    })
    assert.equal(res.estado, 'NO_CALCULADA')
    assert.equal(res.mostrarBloque, true)
  })

  it('returns OCULTO for non-IOL procedures', () => {
    const res = evaluarBloqueLio({
      practica_nombre: 'VITRECTOMIA POSTERIOR',
      lleva_lente: false,
    })
    assert.equal(res.estado, 'OCULTO')
    assert.equal(res.mostrarBloque, false)
  })
})

describe('obtenerClasePractica', () => {
  it('maps <= 26 chars to lg tier and defaults formato to 3x2', () => {
    assert.equal(obtenerClasePractica('FACOEMULSIFICACION'), 'sticker-proc-3x2-lg')
    assert.equal(obtenerClasePractica('A'.repeat(26), '4x2'), 'sticker-proc-4x2-lg')
  })

  it('maps 27..45 chars to md tier', () => {
    assert.equal(obtenerClasePractica('A'.repeat(27), '3x2'), 'sticker-proc-3x2-md')
    assert.equal(obtenerClasePractica('A'.repeat(45), '4x2'), 'sticker-proc-4x2-md')
  })

  it('maps > 45 chars to sm tier', () => {
    assert.equal(obtenerClasePractica('A'.repeat(46), '3x2'), 'sticker-proc-3x2-sm')
    assert.equal(
      obtenerClasePractica('CATARATA CON FACOEMULSIFICACION E IMPL.LIO PLEGABLE (EN CONVENIO)', '4x2'),
      'sticker-proc-4x2-sm'
    )
  })

  it('collapses extra whitespace and falls back cleanly for empty/null input', () => {
    assert.equal(obtenerClasePractica('   VITRECTOMIA   POSTERIOR   ', '3x2'), 'sticker-proc-3x2-lg')
    assert.equal(obtenerClasePractica(null, '4x2'), 'sticker-proc-4x2-lg')
    assert.equal(obtenerClasePractica('   ', '3x2'), 'sticker-proc-3x2-lg')
  })
})
