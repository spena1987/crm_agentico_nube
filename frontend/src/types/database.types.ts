export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      pacientes: {
        Row: {
          id: string
          telefono: string
          nombre: string
          email: string | null
          historial_notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          telefono: string
          nombre: string
          email?: string | null
          historial_notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          telefono?: string
          nombre?: string
          email?: string | null
          historial_notas?: string | null
          created_at?: string
        }
      }
      conversaciones: {
        Row: {
          id: string
          paciente_id: string
          bot_disabled: boolean
          ultimo_mensaje: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          paciente_id: string
          bot_disabled?: boolean
          ultimo_mensaje?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          paciente_id?: string
          bot_disabled?: boolean
          ultimo_mensaje?: string | null
          updated_at?: string
        }
      }
      mensajes: {
        Row: {
          id: string
          conversacion_id: string
          emisor: 'paciente' | 'bot' | 'operador'
          contenido: string
          metadata_json: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversacion_id: string
          emisor: 'paciente' | 'bot' | 'operador'
          contenido: string
          metadata_json?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversacion_id?: string
          emisor?: 'paciente' | 'bot' | 'operador'
          contenido?: string
          metadata_json?: Json
          created_at?: string
        }
      }
      servicios_precios: {
        Row: {
          id: string
          nombre_prestacion: string
          codigo: string
          precio: number
          activo: boolean
        }
        Insert: {
          id?: string
          nombre_prestacion: string
          codigo: string
          precio: number
          activo?: boolean
        }
        Update: {
          id?: string
          nombre_prestacion?: string
          codigo?: string
          precio?: number
          activo?: boolean
        }
      }
      presupuestos: {
        Row: {
          id: string
          paciente_id: string
          estado: 'borrador' | 'enviado' | 'aprobado' | 'rechazado'
          total: number
          pdf_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          paciente_id: string
          estado?: 'borrador' | 'enviado' | 'aprobado' | 'rechazado'
          total?: number
          pdf_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          paciente_id?: string
          estado?: 'borrador' | 'enviado' | 'aprobado' | 'rechazado'
          total?: number
          pdf_url?: string | null
          created_at?: string
        }
      }
      items_presupuesto: {
        Row: {
          id: string
          presupuesto_id: string
          servicio_id: string
          cantidad: number
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          id?: string
          presupuesto_id: string
          servicio_id: string
          cantidad?: number
          precio_unitario: number
          subtotal: number
        }
        Update: {
          id?: string
          presupuesto_id?: string
          servicio_id?: string
          cantidad?: number
          precio_unitario?: number
          subtotal?: number
        }
      }
    }
  }
}
