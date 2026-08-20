# Catálogo de Referencia API Geclisa (v3.25)

**URL de Documentación Swagger**: http://apigeclisa.centrovision.com.ar:88/swagger
**Especificación OpenAPI**: http://apigeclisa.centrovision.com.ar:88/swagger/v1/swagger.json
**Total de Endpoints Registrados**: 1205

---

## 📦 Módulo: Pacientes (22 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/Pacientes |  |
| GET | /api/Pacientes/Documento-AR/{documento} |  |
| GET | /api/Pacientes/Documento/{documento} |  |
| GET | /api/Pacientes/Patient |  |
| GET | /api/Pacientes/advertencias-datosAfiliatorios |  |
| GET | /api/Pacientes/advertencias/{fichaId} |  |
| GET | /api/Pacientes/calcular-edad |  |
| GET | /api/Pacientes/datos-afiliatorios/{meId} |  |
| GET | /api/Pacientes/documento-paginated |  |
| GET | /api/Pacientes/email |  |
| GET | /api/Pacientes/ficha-paciente-by-ben-id/{benId} |  |
| GET | /api/Pacientes/fullname |  |
| POST | /api/Pacientes/generar-nro-hc |  |
| GET | /api/Pacientes/internado |  |
| GET | /api/Pacientes/nrohc/{nroHc} |  |
| GET | /api/Pacientes/os-plan/{fichaId} |  |
| GET | /api/Pacientes/patient-asistente/{fichaId} |  |
| GET | /api/Pacientes/patient/{fichaId} |  |
| GET | /api/Pacientes/reingresos-amb |  |
| POST | /api/Pacientes/save-patient |  |
| GET | /api/Pacientes/validar-nro-hc |  |
| GET | /api/Pacientes/validar-numero-afiliado-pami/{nroAfiliado} |  |

## 📦 Módulo: Ficha (26 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/Ficha |  |
| GET | /api/Ficha |  |
| POST | /api/Ficha/alergias |  |
| GET | /api/Ficha/alergias |  |
| DELETE | /api/Ficha/alergias/{alergiaId} |  |
| GET | /api/Ficha/alergias/{fichaId} |  |
| GET | /api/Ficha/datos-relevantes |  |
| GET | /api/Ficha/datos-similares |  |
| GET | /api/Ficha/domicilio/{fichaId} |  |
| PATCH | /api/Ficha/email/{fichaId} |  |
| GET | /api/Ficha/ficha-plan |  |
| POST | /api/Ficha/ficha-plan/{fichaId} |  |
| POST | /api/Ficha/ficha-por-paciente |  |
| GET | /api/Ficha/historia-clinica/{fichaId} |  |
| POST | /api/Ficha/mediciones |  |
| GET | /api/Ficha/mediciones-historial/{fichaId} |  |
| GET | /api/Ficha/mediciones/{fichaId} |  |
| GET | /api/Ficha/nro-afiliado |  |
| PUT | /api/Ficha/observaciones-hc/{fichaId} |  |
| GET | /api/Ficha/prestadores-usuario |  |
| POST | /api/Ficha/relevantes |  |
| GET | /api/Ficha/relevantes/{fichaId} |  |
| DELETE | /api/Ficha/relevantes/{relevantesId} |  |
| POST | /api/Ficha/save-ficha-atencion |  |
| POST | /api/Ficha/update-ficha |  |
| GET | /api/Ficha/usuario-tiene-prestadores |  |

## 📦 Módulo: Turnos (53 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/Turnos |  |
| GET | /api/Turnos/Canales |  |
| GET | /api/Turnos/Estados |  |
| POST | /api/Turnos/GetTurnos |  |
| POST | /api/Turnos/GetTurnosBorrados |  |
| POST | /api/Turnos/ListarTurnos |  |
| POST | /api/Turnos/ListarTurnos/{turnoMultipleId} |  |
| POST | /api/Turnos/NumeroRecepcion |  |
| GET | /api/Turnos/Pacientes/{fichaId} |  |
| GET | /api/Turnos/TurnosByDoc-AR/{document} |  |
| GET | /api/Turnos/TurnosByDoc/{document} |  |
| POST | /api/Turnos/anular/{turnoBorradoId} |  |
| POST | /api/Turnos/asistente/guardar-turno |  |
| GET | /api/Turnos/asistente/prestador |  |
| GET | /api/Turnos/asistente/prestadores |  |
| GET | /api/Turnos/asistente/servicios |  |
| GET | /api/Turnos/asistente/servicios-sesiones |  |
| POST | /api/Turnos/cant-max-turnos |  |
| POST | /api/Turnos/confirmar-agenda |  |
| POST | /api/Turnos/delete-turno-bloqueo/{tmpTurId} |  |
| POST | /api/Turnos/detalle-cancelacion/whatsapp/{turnoBorradoId} |  |
| POST | /api/Turnos/detalle-multiple/whatsapp/{turnoMultipleId} |  |
| POST | /api/Turnos/detalle/whatsapp/{turnoId} |  |
| POST | /api/Turnos/detalle/{turnoId} |  |
| GET | /api/Turnos/envios-recordatorios-turnos |  |
| GET | /api/Turnos/historial-paciente |  |
| GET | /api/Turnos/informacion-adicional/{turnoId} |  |
| POST | /api/Turnos/list |  |
| POST | /api/Turnos/lista |  |
| POST | /api/Turnos/listarTurnos-excel |  |
| PUT | /api/Turnos/marcar-atendido/{turnoId} |  |
| GET | /api/Turnos/multiple-de-turno/{turnoId} |  |
| POST | /api/Turnos/multiples |  |
| GET | /api/Turnos/pendientes/{fichaId} |  |
| GET | /api/Turnos/prestacion/{turnoId} |  |
| GET | /api/Turnos/prestador/{preId} |  |
| POST | /api/Turnos/relacionar-item-ficha-catastral |  |
| POST | /api/Turnos/reporte-turno/{turnoId} |  |
| POST | /api/Turnos/repositorio |  |
| GET | /api/Turnos/sala-administrativa/{salaTurnoId} |  |
| GET | /api/Turnos/tipoFechasTurnos |  |
| GET | /api/Turnos/tipoReporte |  |
| POST | /api/Turnos/turno-bloqueo |  |
| GET | /api/Turnos/turno-by-id/{turnoId} |  |
| POST | /api/Turnos/valida-disponibilidad |  |
| GET | /api/Turnos/validar-turno-sala/{salaTurnoId}/{salaActualId} |  |
| GET | /api/Turnos/{osId}/pide-token |  |
| GET | /api/Turnos/{turnoId} |  |
| GET | /api/Turnos/{turnoId}/Pacientes/{fichaId}/AutoRecepcion/{numRecId} |  |
| POST | /api/Turnos/{turnoId}/cancelar |  |
| POST | /api/Turnos/{turnoId}/cancelar-confirmacion |  |
| POST | /api/Turnos/{turnoId}/confirmar |  |
| GET | /api/Turnos/{turnoId}/detalle |  |

## 📦 Módulo: HistoriaClinica (15 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/HistoriaClinica/configuracion-avanzada |  |
| POST | /api/HistoriaClinica/configuracion-avanzada |  |
| POST | /api/HistoriaClinica/consulta-evoluciones |  |
| GET | /api/HistoriaClinica/deshabilitar-texto-libre-evolucion-hc |  |
| DELETE | /api/HistoriaClinica/eliminar-hc/{hcId} |  |
| POST | /api/HistoriaClinica/existe-internacion-abierta |  |
| GET | /api/HistoriaClinica/get-firma-plantilla |  |
| POST | /api/HistoriaClinica/historico-hc |  |
| POST | /api/HistoriaClinica/log-consulta |  |
| POST | /api/HistoriaClinica/login-hc |  |
| GET | /api/HistoriaClinica/nueva-habilitada |  |
| GET | /api/HistoriaClinica/permisos-impresion-hc/{meId} |  |
| GET | /api/HistoriaClinica/puede-ver-acciones-hc |  |
| POST | /api/HistoriaClinica/resumen-hc |  |
| GET | /api/HistoriaClinica/validar-editar-eliminar-hc/{hcId} |  |

## 📦 Módulo: Evoluciones (5 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/Evoluciones/antecedentes |  |
| GET | /api/Evoluciones/descargar-archivo/{archivoId} |  |
| POST | /api/Evoluciones/evoluciones |  |
| POST | /api/Evoluciones/protocolos-quirurgicos |  |
| GET | /api/Evoluciones/validar-permiso-asociar-problemas/{hcId} |  |

## 📦 Módulo: Prestadores (22 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/Prestadores/SimplePorFiltro |  |
| GET | /api/Prestadores/conceptos |  |
| GET | /api/Prestadores/config-cronogramas-atencion/{preId} |  |
| POST | /api/Prestadores/config-turnos-patient-per-day-by-profesional |  |
| GET | /api/Prestadores/config-turnos-patient-per-day-by-profesional/{preId} |  |
| POST | /api/Prestadores/cuenta-corriente |  |
| POST | /api/Prestadores/detalle-comprobante-by-id |  |
| POST | /api/Prestadores/detalle-comprobante-cancelatorio-by-id |  |
| GET | /api/Prestadores/disponibles/{conwhatsapp} |  |
| GET | /api/Prestadores/get-firma-hc/{preId} |  |
| GET | /api/Prestadores/grupo-de-trabajo |  |
| GET | /api/Prestadores/listado |  |
| GET | /api/Prestadores/observaciones |  |
| GET | /api/Prestadores/por-id/{preId} |  |
| GET | /api/Prestadores/por-matricula |  |
| GET | /api/Prestadores/por-matricula-nombre |  |
| GET | /api/Prestadores/por-usuario |  |
| GET | /api/Prestadores/servicios |  |
| GET | /api/Prestadores/solicitantes |  |
| GET | /api/Prestadores/usuarios-asociados/{preId} |  |
| GET | /api/Prestadores/v2/disponibles/{conwhatsapp} |  |
| GET | /api/Prestadores/{preId}/activo-en-financiador |  |

## 📦 Módulo: ObrasSociales (47 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/ObrasSociales |  |
| GET | /api/ObrasSociales/all |  |
| POST | /api/ObrasSociales/anular-autorizacion/gecros |  |
| DELETE | /api/ObrasSociales/anular-prescripciones |  |
| POST | /api/ObrasSociales/anular-prestacion |  |
| DELETE | /api/ObrasSociales/anular-receta-recipe |  |
| POST | /api/ObrasSociales/anularautorizacion |  |
| POST | /api/ObrasSociales/asignacion-componente-receta |  |
| POST | /api/ObrasSociales/autorizar |  |
| POST | /api/ObrasSociales/autorizar/gecros |  |
| GET | /api/ObrasSociales/componente-receta-id/{osId} |  |
| GET | /api/ObrasSociales/componentes-receta-por-financiador |  |
| GET | /api/ObrasSociales/componentes-recetas-electronicas |  |
| POST | /api/ObrasSociales/componentes-recetas-electronicas |  |
| POST | /api/ObrasSociales/componentes-recetas-electronicas-log |  |
| GET | /api/ObrasSociales/componentes-recetas-electronicas-status |  |
| GET | /api/ObrasSociales/configuracion-ws |  |
| POST | /api/ObrasSociales/consultarautorizacion |  |
| GET | /api/ObrasSociales/controles-ws |  |
| POST | /api/ObrasSociales/coseguros-preparaciones |  |
| POST | /api/ObrasSociales/crear-receta-recipe |  |
| GET | /api/ObrasSociales/datos-os-plan |  |
| GET | /api/ObrasSociales/detalle-ws |  |
| GET | /api/ObrasSociales/encabezado-ws |  |
| GET | /api/ObrasSociales/enrolamientos-osep |  |
| GET | /api/ObrasSociales/financiador-by-id |  |
| POST | /api/ObrasSociales/financiador-os |  |
| GET | /api/ObrasSociales/financiador-por-idplan/{planId} |  |
| POST | /api/ObrasSociales/financiadores-por-prestador |  |
| GET | /api/ObrasSociales/financiadores-recipe |  |
| GET | /api/ObrasSociales/financiadores-search |  |
| POST | /api/ObrasSociales/habilitado-por-ubicacion |  |
| POST | /api/ObrasSociales/prescribir-electronico-pedido-estudio |  |
| POST | /api/ObrasSociales/prescribir-electronico-pedido-estudio-con-practicas |  |
| GET | /api/ObrasSociales/responsables-facturacion-osep |  |
| GET | /api/ObrasSociales/sucursales-osep |  |
| GET | /api/ObrasSociales/tipos-practicas-financiador |  |
| POST | /api/ObrasSociales/ubicacion-os |  |
| POST | /api/ObrasSociales/validar |  |
| GET | /api/ObrasSociales/validar-anulacion-prescripciones/{pedidoEstudioId} |  |
| POST | /api/ObrasSociales/validarafiliado |  |
| GET | /api/ObrasSociales/{osId} |  |
| POST | /api/ObrasSociales/{osId}/normas-operativas |  |
| GET | /api/ObrasSociales/{osId}/planes |  |
| POST | /api/ObrasSociales/{osId}/registrar-prestacion |  |
| POST | /api/ObrasSociales/{osId}/validar-padron |  |
| POST | /api/ObrasSociales/{osId}/validar-padron-gecros |  |

## 📦 Módulo: Nomenclador (16 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/Nomenclador/all-practicas |  |
| GET | /api/Nomenclador/coseguro-prestador |  |
| GET | /api/Nomenclador/practica/conceptos |  |
| GET | /api/Nomenclador/practica/conceptos-prestadores |  |
| GET | /api/Nomenclador/practica/control-codigo |  |
| GET | /api/Nomenclador/practicaByTipo |  |
| GET | /api/Nomenclador/practicas |  |
| POST | /api/Nomenclador/practicas |  |
| GET | /api/Nomenclador/preparacion-practica |  |
| GET | /api/Nomenclador/tipoNom-by-plan |  |
| GET | /api/Nomenclador/tipos |  |
| POST | /api/Nomenclador/tope-practica |  |
| POST | /api/Nomenclador/validacionesPractica |  |
| POST | /api/Nomenclador/validar-cobertura-por-practica |  |
| GET | /api/Nomenclador/validar-practica-plan |  |
| GET | /api/Nomenclador/validar-prestador |  |

## 📦 Módulo: Presupuestos (19 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/Presupuestos/by-ficha |  |
| POST | /api/Presupuestos/copy |  |
| DELETE | /api/Presupuestos/delete-all-practicas/{presupuestoId} |  |
| DELETE | /api/Presupuestos/delete-practica/{presupuestoDetaId} |  |
| DELETE | /api/Presupuestos/delete/{presupuestoId} |  |
| POST | /api/Presupuestos/list |  |
| GET | /api/Presupuestos/lista-practicas/{presupuestoId} |  |
| POST | /api/Presupuestos/marcar-aceptado-desestimado |  |
| GET | /api/Presupuestos/observacion-por-defecto |  |
| POST | /api/Presupuestos/save |  |
| POST | /api/Presupuestos/save-practicas |  |
| POST | /api/Presupuestos/send-mail |  |
| GET | /api/Presupuestos/tiene-practicas-asociadas/{presupuestoId} |  |
| GET | /api/Presupuestos/tiene-practicas-conceptos/{presupuestoId} |  |
| GET | /api/Presupuestos/tiene-practicas/{presupuestoId} |  |
| POST | /api/Presupuestos/valorizar-practica |  |
| POST | /api/Presupuestos/valorizar-practica-asociadas |  |
| GET | /api/Presupuestos/{id} |  |
| GET | /api/Presupuestos/{id}/historial-usuarios |  |

## 📦 Módulo: Facturacion (16 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/Facturacion/DetalleCompCancelaFacturaOSById |  |
| POST | /api/Facturacion/DetalleCompFacturaOSById |  |
| POST | /api/Facturacion/all-atenciones-de-tratamiento |  |
| GET | /api/Facturacion/atenciones-incluidas/{id} |  |
| GET | /api/Facturacion/codigos-oms/{tCodId} |  |
| POST | /api/Facturacion/cuenta-corriente |  |
| POST | /api/Facturacion/diagnostico |  |
| DELETE | /api/Facturacion/diagnostico/{meDiagId} |  |
| POST | /api/Facturacion/diagnosticos-resumen |  |
| DELETE | /api/Facturacion/diagnosticos-resumen/{meId} |  |
| POST | /api/Facturacion/get-comprobantes-facturacion-os |  |
| GET | /api/Facturacion/mensajes-enviados/{id} |  |
| POST | /api/Facturacion/practicas-autorizadas |  |
| POST | /api/Facturacion/save-atenciones-de-tratamiento |  |
| POST | /api/Facturacion/tratamiento |  |
| DELETE | /api/Facturacion/tratamientos/{id} |  |

## 📦 Módulo: PedidosEstudios (24 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/PedidosEstudios/Crear |  |
| GET | /api/PedidosEstudios/cantidad-grupo-pra |  |
| GET | /api/PedidosEstudios/carga-from-atencion |  |
| GET | /api/PedidosEstudios/datos-completos-pedido/{pedEstEId} |  |
| POST | /api/PedidosEstudios/enviar-email |  |
| POST | /api/PedidosEstudios/generar-practicas-internado |  |
| GET | /api/PedidosEstudios/historial-usuarios-pedidos-estudios/{id} |  |
| POST | /api/PedidosEstudios/listado-pedidos-estudios |  |
| POST | /api/PedidosEstudios/multiple-validar-tope |  |
| POST | /api/PedidosEstudios/new-practica-pedido |  |
| POST | /api/PedidosEstudios/pedidos-estudios-hc |  |
| DELETE | /api/PedidosEstudios/pedidos-estudios-hc/{pedEstId} |  |
| GET | /api/PedidosEstudios/permisos-imprimir |  |
| POST | /api/PedidosEstudios/porc-os-por-practicas |  |
| POST | /api/PedidosEstudios/practicas-from-plantilla |  |
| GET | /api/PedidosEstudios/practicas-pedido-estudios |  |
| GET | /api/PedidosEstudios/practicas-pedido-hc/{pedEstId} |  |
| POST | /api/PedidosEstudios/printmany-estudios |  |
| POST | /api/PedidosEstudios/rechazar-practicas |  |
| PUT | /api/PedidosEstudios/rechazar-practicas |  |
| POST | /api/PedidosEstudios/save-multiple-pedido |  |
| GET | /api/PedidosEstudios/validar-generar-practicas/{meId} |  |
| GET | /api/PedidosEstudios/validar-permiso-asociar-problemas/{pedEstId} |  |
| POST | /api/PedidosEstudios/validar-practicas-carga-pedido |  |

## 📦 Módulo: Estudios (5 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/Estudios/estudios |  |
| GET | /api/Estudios/informe-diagnostico/{infoId} |  |
| GET | /api/Estudios/informe-laboratorio-pdf/{infoLabId} |  |
| GET | /api/Estudios/obtener-url-imagen/{mpId} |  |
| GET | /api/Estudios/validar-permiso-asociar-problemas |  |

## 📦 Módulo: Recetas (7 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/Recetas |  |
| GET | /api/Recetas/detalle/{recetaId} |  |
| POST | /api/Recetas/filtrar |  |
| GET | /api/Recetas/validar-permiso-asociar-problemas/{recetaId} |  |
| GET | /api/Recetas/validar-permiso/{recetaId} |  |
| GET | /api/Recetas/{recetaId} |  |
| DELETE | /api/Recetas/{recetaId} |  |

## 📦 Módulo: InteligenciaArtificial (19 métodos)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/InteligenciaArtificial/generar-respuesta-prompt |  |
| GET | /api/InteligenciaArtificial/prompt-codigos |  |
| POST | /api/InteligenciaArtificial/prompt-codigos |  |
| PUT | /api/InteligenciaArtificial/prompt-codigos/es-editable |  |
| POST | /api/InteligenciaArtificial/prompt-personalizado |  |
| POST | /api/InteligenciaArtificial/prompt-procesado |  |
| POST | /api/InteligenciaArtificial/prompt-sin-procesar |  |
| POST | /api/InteligenciaArtificial/prompts |  |
| PUT | /api/InteligenciaArtificial/prompts |  |
| GET | /api/InteligenciaArtificial/prompts-defecto |  |
| GET | /api/InteligenciaArtificial/prompts-defecto/{promptId} |  |
| GET | /api/InteligenciaArtificial/prompts-por-codigo/{promptCodigoId} |  |
| DELETE | /api/InteligenciaArtificial/prompts/{promptId} |  |
| GET | /api/InteligenciaArtificial/prompts/{promptId}/historial-usuarios |  |
| POST | /api/InteligenciaArtificial/reemplazar-variables |  |
| GET | /api/InteligenciaArtificial/usuario-puede-editar-prompts/{promptCodigo} |  |
| GET | /api/InteligenciaArtificial/variables |  |
| GET | /api/InteligenciaArtificial/variables-aplicables/{promptId} |  |
| GET | /api/InteligenciaArtificial/variables/{promptId} |  |
