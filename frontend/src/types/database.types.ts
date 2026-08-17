export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      agentes_directivas_globales: {
        Row: {
          agente_defecto_codigo: string
          created_at: string | null
          guardrails_medicos: string
          id: string
          nombre_clinica: string
          politica_escalamiento: string
          politica_presupuestos: string | null
          politica_turnos: string | null
          tono_general: string
          updated_at: string | null
        }
        Insert: {
          agente_defecto_codigo?: string
          created_at?: string | null
          guardrails_medicos?: string
          id?: string
          nombre_clinica?: string
          politica_escalamiento?: string
          politica_presupuestos?: string | null
          politica_turnos?: string | null
          tono_general?: string
          updated_at?: string | null
        }
        Update: {
          agente_defecto_codigo?: string
          created_at?: string | null
          guardrails_medicos?: string
          id?: string
          nombre_clinica?: string
          politica_escalamiento?: string
          politica_presupuestos?: string | null
          politica_turnos?: string | null
          tono_general?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agentes_situacionales: {
        Row: {
          activo: boolean | null
          codigo: string
          created_at: string | null
          criterios_activacion: Json | null
          descripcion: string | null
          directiva_particular: string
          herramientas_habilitadas: Json | null
          id: string
          nombre: string
          orden: number | null
          temperatura: number | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          created_at?: string | null
          criterios_activacion?: Json | null
          descripcion?: string | null
          directiva_particular: string
          herramientas_habilitadas?: Json | null
          id?: string
          nombre: string
          orden?: number | null
          temperatura?: number | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          created_at?: string | null
          criterios_activacion?: Json | null
          descripcion?: string | null
          directiva_particular?: string
          herramientas_habilitadas?: Json | null
          id?: string
          nombre?: string
          orden?: number | null
          temperatura?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      asesoria_evoluciones: {
        Row: {
          asesoria_id: string
          contenido: string
          created_at: string
          fecha_contacto: string
          id: string
          paciente_id: string
          tipo_contacto: string
          usuario_id: string | null
          usuario_nombre: string
        }
        Insert: {
          asesoria_id: string
          contenido: string
          created_at?: string
          fecha_contacto?: string
          id?: string
          paciente_id: string
          tipo_contacto?: string
          usuario_id?: string | null
          usuario_nombre?: string
        }
        Update: {
          asesoria_id?: string
          contenido?: string
          created_at?: string
          fecha_contacto?: string
          id?: string
          paciente_id?: string
          tipo_contacto?: string
          usuario_id?: string | null
          usuario_nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "asesoria_evoluciones_asesoria_id_fkey"
            columns: ["asesoria_id"]
            isOneToOne: false
            referencedRelation: "asesorias_quirurgicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asesoria_evoluciones_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      asesorias_quirurgicas: {
        Row: {
          cobertura_obra_social: string | null
          created_at: string
          estado: string
          fecha_definitiva_cirugia: string | null
          fecha_probable_cirugia: string | null
          id: string
          medico_cirujano_id: number | null
          medico_cirujano_matricula: string | null
          medico_cirujano_nombre: string | null
          medico_derivador_id: number | null
          medico_derivador_matricula: string | null
          medico_derivador_nombre: string | null
          moneda_extra: string | null
          monto_extra: number | null
          motivo_cancelacion: string | null
          paciente_id: string
          practica_codigo: string | null
          practica_nombre: string
          presupuesto_id: string | null
          situacion_paciente: string | null
          updated_at: string
        }
        Insert: {
          cobertura_obra_social?: string | null
          created_at?: string
          estado?: string
          fecha_definitiva_cirugia?: string | null
          fecha_probable_cirugia?: string | null
          id?: string
          medico_cirujano_id?: number | null
          medico_cirujano_matricula?: string | null
          medico_cirujano_nombre?: string | null
          medico_derivador_id?: number | null
          medico_derivador_matricula?: string | null
          medico_derivador_nombre?: string | null
          moneda_extra?: string | null
          monto_extra?: number | null
          motivo_cancelacion?: string | null
          paciente_id: string
          practica_codigo?: string | null
          practica_nombre: string
          presupuesto_id?: string | null
          situacion_paciente?: string | null
          updated_at?: string
        }
        Update: {
          cobertura_obra_social?: string | null
          created_at?: string
          estado?: string
          fecha_definitiva_cirugia?: string | null
          fecha_probable_cirugia?: string | null
          id?: string
          medico_cirujano_id?: number | null
          medico_cirujano_matricula?: string | null
          medico_cirujano_nombre?: string | null
          medico_derivador_id?: number | null
          medico_derivador_matricula?: string | null
          medico_derivador_nombre?: string | null
          moneda_extra?: string | null
          monto_extra?: number | null
          motivo_cancelacion?: string | null
          paciente_id?: string
          practica_codigo?: string | null
          practica_nombre?: string
          presupuesto_id?: string | null
          situacion_paciente?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asesorias_quirurgicas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asesorias_quirurgicas_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_nomenclador: {
        Row: {
          geclisa_area_default: string
          geclisa_particular_os_id: number
          geclisa_particular_plan_id: number
          id: string
          nomencladores_activos: number[]
          updated_at: string
        }
        Insert: {
          geclisa_area_default?: string
          geclisa_particular_os_id?: number
          geclisa_particular_plan_id?: number
          id?: string
          nomencladores_activos?: number[]
          updated_at?: string
        }
        Update: {
          geclisa_area_default?: string
          geclisa_particular_os_id?: number
          geclisa_particular_plan_id?: number
          id?: string
          nomencladores_activos?: number[]
          updated_at?: string
        }
        Relationships: []
      }
      configuracion_seguridad: {
        Row: {
          aviso_segundos: number
          id: string
          inactividad_habilitada: boolean
          inactividad_minutos: number
          updated_at: string
        }
        Insert: {
          aviso_segundos?: number
          id?: string
          inactividad_habilitada?: boolean
          inactividad_minutos?: number
          updated_at?: string
        }
        Update: {
          aviso_segundos?: number
          id?: string
          inactividad_habilitada?: boolean
          inactividad_minutos?: number
          updated_at?: string
        }
        Relationships: []
      }
      conversaciones: {
        Row: {
          agente_asignado_codigo: string | null
          archivada: boolean
          bot_disabled: boolean
          id: string
          paciente_id: string
          ultimo_mensaje: string | null
          updated_at: string
        }
        Insert: {
          agente_asignado_codigo?: string | null
          archivada?: boolean
          bot_disabled?: boolean
          id?: string
          paciente_id: string
          ultimo_mensaje?: string | null
          updated_at?: string
        }
        Update: {
          agente_asignado_codigo?: string | null
          archivada?: boolean
          bot_disabled?: boolean
          id?: string
          paciente_id?: string
          ultimo_mensaje?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: true
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      items_presupuesto: {
        Row: {
          cantidad: number
          id: string
          precio_unitario: number
          presupuesto_id: string
          servicio_id: string
          subtotal: number
        }
        Insert: {
          cantidad?: number
          id?: string
          precio_unitario: number
          presupuesto_id: string
          servicio_id: string
          subtotal: number
        }
        Update: {
          cantidad?: number
          id?: string
          precio_unitario?: number
          presupuesto_id?: string
          servicio_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_presupuesto_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_presupuesto_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios_precios"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes: {
        Row: {
          contenido: string
          conversacion_id: string
          created_at: string
          emisor: string
          id: string
          metadata_json: Json
        }
        Insert: {
          contenido: string
          conversacion_id: string
          created_at?: string
          emisor: string
          id?: string
          metadata_json?: Json
        }
        Update: {
          contenido?: string
          conversacion_id?: string
          created_at?: string
          emisor?: string
          id?: string
          metadata_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          icono: string | null
          nombre: string
          orden: number | null
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          icono?: string | null
          nombre: string
          orden?: number | null
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          icono?: string | null
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      nomenclador_aranceles: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          moneda: string
          observaciones: string | null
          practica_id: string
          precio: number
          vigencia_desde: string
          vigencia_hasta: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          moneda?: string
          observaciones?: string | null
          practica_id: string
          precio: number
          vigencia_desde?: string
          vigencia_hasta?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          moneda?: string
          observaciones?: string | null
          practica_id?: string
          precio?: number
          vigencia_desde?: string
          vigencia_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nomenclador_aranceles_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: false
            referencedRelation: "nomenclador_practicas"
            referencedColumns: ["id"]
          },
        ]
      }
      nomenclador_practicas: {
        Row: {
          activo: boolean
          categoria: string | null
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          nomenclador_id: string
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          nomenclador_id: string
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          nomenclador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomenclador_practicas_nomenclador_id_fkey"
            columns: ["nomenclador_id"]
            isOneToOne: false
            referencedRelation: "nomencladores"
            referencedColumns: ["id"]
          },
        ]
      }
      nomencladores: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          moneda_default: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          moneda_default?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          moneda_default?: string
          nombre?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          created_at: string
          direccion: string | null
          dni: string | null
          email: string | null
          etapa_clinica: string | null
          fecha_nacimiento: string | null
          geclisa_ficha_id: number | null
          historial_notas: string | null
          id: string
          medico_cabecera: string | null
          medico_cabecera_especialidad: string | null
          medico_cabecera_id: number | null
          medico_cabecera_matricula: string | null
          medico_cabecera_nombre: string | null
          nombre: string
          nro_hc: string | null
          obra_social: string | null
          plan_cobertura: string | null
          sexo: string | null
          telefono: string
          telefono_fijo: string | null
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          dni?: string | null
          email?: string | null
          etapa_clinica?: string | null
          fecha_nacimiento?: string | null
          geclisa_ficha_id?: number | null
          historial_notas?: string | null
          id?: string
          medico_cabecera?: string | null
          medico_cabecera_especialidad?: string | null
          medico_cabecera_id?: number | null
          medico_cabecera_matricula?: string | null
          medico_cabecera_nombre?: string | null
          nombre: string
          nro_hc?: string | null
          obra_social?: string | null
          plan_cobertura?: string | null
          sexo?: string | null
          telefono: string
          telefono_fijo?: string | null
        }
        Update: {
          created_at?: string
          direccion?: string | null
          dni?: string | null
          email?: string | null
          etapa_clinica?: string | null
          fecha_nacimiento?: string | null
          geclisa_ficha_id?: number | null
          historial_notas?: string | null
          id?: string
          medico_cabecera?: string | null
          medico_cabecera_especialidad?: string | null
          medico_cabecera_id?: number | null
          medico_cabecera_matricula?: string | null
          medico_cabecera_nombre?: string | null
          nombre?: string
          nro_hc?: string | null
          obra_social?: string | null
          plan_cobertura?: string | null
          sexo?: string | null
          telefono?: string
          telefono_fijo?: string | null
        }
        Relationships: []
      }
      practicas_crm: {
        Row: {
          activo: boolean
          categoria: string | null
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          precio: number
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          precio: number
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          precio?: number
        }
        Relationships: []
      }
      practicas_precios_override: {
        Row: {
          activo: boolean
          id: string
          nom_cod: string
          nom_id: number
          nombre_referencia: string
          observacion: string | null
          precio_override: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          id?: string
          nom_cod: string
          nom_id: number
          nombre_referencia: string
          observacion?: string | null
          precio_override: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          id?: string
          nom_cod?: string
          nom_id?: number
          nombre_referencia?: string
          observacion?: string | null
          precio_override?: number
          updated_at?: string
        }
        Relationships: []
      }
      presupuestos: {
        Row: {
          asesoria_id: string | null
          created_at: string
          estado: string
          id: string
          paciente_id: string
          pdf_url: string | null
          total: number
        }
        Insert: {
          asesoria_id?: string | null
          created_at?: string
          estado?: string
          id?: string
          paciente_id: string
          pdf_url?: string | null
          total?: number
        }
        Update: {
          asesoria_id?: string | null
          created_at?: string
          estado?: string
          id?: string
          paciente_id?: string
          pdf_url?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_asesoria_id_fkey"
            columns: ["asesoria_id"]
            isOneToOne: false
            referencedRelation: "asesorias_quirurgicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      rol_permisos: {
        Row: {
          accion: string
          created_at: string
          id: string
          modulo_codigo: string
          permitido: boolean
          rol_id: string
        }
        Insert: {
          accion: string
          created_at?: string
          id?: string
          modulo_codigo: string
          permitido?: boolean
          rol_id: string
        }
        Update: {
          accion?: string
          created_at?: string
          id?: string
          modulo_codigo?: string
          permitido?: boolean
          rol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rol_permisos_modulo_codigo_fkey"
            columns: ["modulo_codigo"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "rol_permisos_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          codigo: string
          created_at: string
          descripcion: string | null
          es_sistema: boolean
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descripcion?: string | null
          es_sistema?: boolean
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descripcion?: string | null
          es_sistema?: boolean
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      servicios_precios: {
        Row: {
          activo: boolean
          codigo: string
          id: string
          nombre_prestacion: string
          precio: number
        }
        Insert: {
          activo?: boolean
          codigo: string
          id?: string
          nombre_prestacion: string
          precio: number
        }
        Update: {
          activo?: boolean
          codigo?: string
          id?: string
          nombre_prestacion?: string
          precio?: number
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          accion: string
          created_at: string
          detalles: Json
          duracion_ms: number | null
          http_status: number | null
          id: string
          mensaje: string
          modulo: string
          nivel: string
          paciente_id: string | null
          trace: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          detalles?: Json
          duracion_ms?: number | null
          http_status?: number | null
          id?: string
          mensaje: string
          modulo: string
          nivel: string
          paciente_id?: string | null
          trace?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          detalles?: Json
          duracion_ms?: number | null
          http_status?: number | null
          id?: string
          mensaje?: string
          modulo?: string
          nivel?: string
          paciente_id?: string | null
          trace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_perfil: {
        Row: {
          activo: boolean
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nombre_completo: string
          rol_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nombre_completo: string
          rol_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre_completo?: string
          rol_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_perfil_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
