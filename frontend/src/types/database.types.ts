export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      conversaciones: {
        Row: {
          bot_disabled: boolean
          id: string
          paciente_id: string
          ultimo_mensaje: string | null
          updated_at: string
        }
        Insert: {
          bot_disabled?: boolean
          id?: string
          paciente_id: string
          ultimo_mensaje?: string | null
          updated_at?: string
        }
        Update: {
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
      pacientes: {
        Row: {
          created_at: string
          email: string | null
          historial_notas: string | null
          id: string
          nombre: string
          telefono: string
          geclisa_ficha_id?: number | null
          dni?: string | null
          nro_hc?: string | null
          obra_social?: string | null
          plan_cobertura?: string | null
          fecha_nacimiento?: string | null
          sexo?: string | null
          direccion?: string | null
          telefono_fijo?: string | null
          medico_cabecera?: string | null
          medico_cabecera_id?: number | null
          medico_cabecera_nombre?: string | null
          medico_cabecera_matricula?: string | null
          medico_cabecera_especialidad?: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          historial_notas?: string | null
          id?: string
          nombre: string
          telefono: string
          geclisa_ficha_id?: number | null
          dni?: string | null
          nro_hc?: string | null
          obra_social?: string | null
          plan_cobertura?: string | null
          fecha_nacimiento?: string | null
          sexo?: string | null
          direccion?: string | null
          telefono_fijo?: string | null
          medico_cabecera?: string | null
          medico_cabecera_id?: number | null
          medico_cabecera_nombre?: string | null
          medico_cabecera_matricula?: string | null
          medico_cabecera_especialidad?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          historial_notas?: string | null
          id?: string
          nombre?: string
          telefono?: string
          geclisa_ficha_id?: number | null
          dni?: string | null
          nro_hc?: string | null
          obra_social?: string | null
          plan_cobertura?: string | null
          fecha_nacimiento?: string | null
          sexo?: string | null
          direccion?: string | null
          telefono_fijo?: string | null
          medico_cabecera?: string | null
          medico_cabecera_id?: number | null
          medico_cabecera_nombre?: string | null
          medico_cabecera_matricula?: string | null
          medico_cabecera_especialidad?: string | null
        }
        Relationships: []
      }
      presupuestos: {
        Row: {
          created_at: string
          estado: string
          id: string
          paciente_id: string
          pdf_url: string | null
          total: number
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          paciente_id: string
          pdf_url?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          paciente_id?: string
          pdf_url?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
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
