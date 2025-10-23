export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          role: "admin" | "seguranca"
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          role?: "admin" | "seguranca"
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          role?: "admin" | "seguranca"
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      analysts: {
        Row: {
          created_at: string | null
          department: string
          email: string
          id: string
          name: string
          phone: string | null
          role: string
          skills: string[] | null
          start_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department: string
          email: string
          id?: string
          name: string
          phone?: string | null
          role: string
          skills?: string[] | null
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          role?: string
          skills?: string[] | null
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          alert_on_no: boolean
          alert_on_yes: boolean
          created_at: string
          id: string
          order_number: number
          question: string
          updated_at: string
        }
        Insert: {
          alert_on_no?: boolean
          alert_on_yes?: boolean
          created_at?: string
          id?: string
          order_number?: number
          question: string
          updated_at?: string
        }
        Update: {
          alert_on_no?: boolean
          alert_on_yes?: boolean
          created_at?: string
          id?: string
          order_number?: number
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          capacity: string
          created_at: string
          id: string
          kp: string
          name: string
          sector: string
          type: string
          updated_at: string
        }
        Insert: {
          capacity: string
          created_at?: string
          id?: string
          kp: string
          name: string
          sector: string
          type: string
          updated_at?: string
        }
        Update: {
          capacity?: string
          created_at?: string
          id?: string
          kp?: string
          name?: string
          sector?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspections: {
        Row: {
          checklist_answers: Json
          comments: string | null
          created_at: string
          equipment_id: string | null
          id: string
          inspection_date: string
          operator_matricula: string | null
          photos: Json | null
          signature: string | null
          submission_date: string
          updated_at: string
        }
        Insert: {
          checklist_answers?: Json
          comments?: string | null
          created_at?: string
          equipment_id?: string | null
          id?: string
          inspection_date: string
          operator_matricula?: string | null
          photos?: Json | null
          signature?: string | null
          submission_date?: string
          updated_at?: string
        }
        Update: {
          checklist_answers?: Json
          comments?: string | null
          created_at?: string
          equipment_id?: string | null
          id?: string
          inspection_date?: string
          operator_matricula?: string | null
          photos?: Json | null
          signature?: string | null
          submission_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_operator_matricula_fkey"
            columns: ["operator_matricula"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["matricula"]
          },
        ]
      }
      leaders: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          operator_matricula: string | null
          password_hash: string
          sector: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          operator_matricula?: string | null
          password_hash: string
          sector: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          operator_matricula?: string | null
          password_hash?: string
          sector?: string
          updated_at?: string
        }
        Relationships: []
      }
      sector_leader_assignments: {
        Row: {
          created_at: string
          id: string
          leader_id: string
          sector_id: string
          shift: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id: string
          sector_id: string
          shift?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string
          sector_id?: string
          shift?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_leader_assignments_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_leader_assignments_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          }
        ]
      }
      operators: {
        Row: {
          cargo: string | null
          created_at: string
          id: string
          matricula: string
          name: string
          senha: string | null
          setor: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          id?: string
          matricula: string
          name: string
          senha?: string | null
          setor?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          id?: string
          matricula?: string
          name?: string
          senha?: string | null
          setor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relatos_turno: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reporter: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reporter?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reporter?: string | null
          status?: string | null
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          description: string | null
          id: string
          leader_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          leader_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          leader_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_tasks: {
        Row: {
          assigned_to: string
          completed_by: string | null
          created_at: string | null
          date: string
          description: string
          id: string
          notes: string | null
          priority: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to: string
          completed_by?: string | null
          created_at?: string | null
          date: string
          description: string
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string
          completed_by?: string | null
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
