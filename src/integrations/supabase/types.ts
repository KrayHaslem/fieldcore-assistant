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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_rules: {
        Row: {
          approver_user_id: string | null
          created_at: string
          department_id: string | null
          id: string
          max_amount: number | null
          min_amount: number
          organization_id: string
          required_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          approver_user_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          max_amount?: number | null
          min_amount?: number
          organization_id: string
          required_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          approver_user_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          max_amount?: number | null
          min_amount?: number
          organization_id?: string
          required_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_rules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assembly_record_components: {
        Row: {
          assembly_record_id: string
          component_item_id: string
          id: string
          quantity_consumed: number
        }
        Insert: {
          assembly_record_id: string
          component_item_id: string
          id?: string
          quantity_consumed: number
        }
        Update: {
          assembly_record_id?: string
          component_item_id?: string
          id?: string
          quantity_consumed?: number
        }
        Relationships: [
          {
            foreignKeyName: "assembly_record_components_assembly_record_id_fkey"
            columns: ["assembly_record_id"]
            isOneToOne: false
            referencedRelation: "assembly_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_record_components_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      assembly_records: {
        Row: {
          created_at: string
          created_by: string
          finished_item_id: string
          id: string
          notes: string | null
          organization_id: string
          quantity_produced: number
        }
        Insert: {
          created_at?: string
          created_by: string
          finished_item_id: string
          id?: string
          notes?: string | null
          organization_id: string
          quantity_produced: number
        }
        Update: {
          created_at?: string
          created_by?: string
          finished_item_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          quantity_produced?: number
        }
        Relationships: [
          {
            foreignKeyName: "assembly_records_finished_item_id_fkey"
            columns: ["finished_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      command_history: {
        Row: {
          command_text: string
          created_at: string
          id: string
          intent_data: Json | null
          intent_type: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          command_text: string
          created_at?: string
          id?: string
          intent_data?: Json | null
          intent_type?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          command_text?: string
          created_at?: string
          id?: string
          intent_data?: Json | null
          intent_type?: string | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          default_unit_cost: number | null
          description: string | null
          id: string
          item_type: Database["public"]["Enums"]["inventory_type"]
          name: string
          organization_id: string
          preferred_supplier_id: string | null
          reorder_point: number | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_unit_cost?: number | null
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["inventory_type"]
          name: string
          organization_id: string
          preferred_supplier_id?: string | null
          reorder_point?: number | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_unit_cost?: number | null
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["inventory_type"]
          name?: string
          organization_id?: string
          preferred_supplier_id?: string | null
          reorder_point?: number | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          item_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          organization_id: string
          quantity: number
          source_id: string | null
          source_type: Database["public"]["Enums"]["source_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          item_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          organization_id: string
          quantity: number
          source_id?: string | null
          source_type: Database["public"]["Enums"]["source_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          item_id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          organization_id?: string
          quantity?: number
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          name: string
          settings: Json | null
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          settings?: Json | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          settings?: Json | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: Database["public"]["Enums"]["inventory_type"]
          organization_id: string
          purchase_order_id: string
          quantity: number
          quantity_received: number | null
          unit_cost: number
          unit_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: Database["public"]["Enums"]["inventory_type"]
          organization_id: string
          purchase_order_id: string
          quantity: number
          quantity_received?: number | null
          unit_cost: number
          unit_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: Database["public"]["Enums"]["inventory_type"]
          organization_id?: string
          purchase_order_id?: string
          quantity?: number
          quantity_received?: number | null
          unit_cost?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          department_id: string | null
          id: string
          notes: string | null
          ordered_at: string | null
          organization_id: string
          po_number: string
          received_at: string | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          organization_id: string
          po_number: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          organization_id?: string
          po_number?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliations: {
        Row: {
          actual_quantity: number
          created_at: string
          created_by: string
          expected_quantity: number
          id: string
          item_id: string
          notes: string | null
          organization_id: string
          variance: number
        }
        Insert: {
          actual_quantity: number
          created_at?: string
          created_by: string
          expected_quantity: number
          id?: string
          item_id: string
          notes?: string | null
          organization_id: string
          variance: number
        }
        Update: {
          actual_quantity?: number
          created_at?: string
          created_by?: string
          expected_quantity?: number
          id?: string
          item_id?: string
          notes?: string | null
          organization_id?: string
          variance?: number
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          access_level: Database["public"]["Enums"]["app_role"]
          chart_type: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          sql_query: string
          supports_date_range: boolean | null
          supports_quarterly: boolean | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["app_role"]
          chart_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          sql_query: string
          supports_date_range?: boolean | null
          supports_quarterly?: boolean | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["app_role"]
          chart_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          sql_query?: string
          supports_date_range?: boolean | null
          supports_quarterly?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          organization_id: string
          quantity: number
          sales_order_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          organization_id: string
          quantity: number
          sales_order_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          organization_id?: string
          quantity?: number
          sales_order_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          created_by: string
          customer_name: string
          id: string
          notes: string | null
          organization_id: string
          so_number: string
          status: Database["public"]["Enums"]["so_status"]
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_name: string
          id?: string
          notes?: string | null
          organization_id: string
          so_number: string
          status?: Database["public"]["Enums"]["so_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          so_number?: string
          status?: Database["public"]["Enums"]["so_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          avg_lead_time_days: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          avg_lead_time_days?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          avg_lead_time_days?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          description: string | null
          id: string
          organization_id: string
          unit_number: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          unit_number: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          unit_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "procurement" | "sales" | "finance" | "employee"
      inventory_type:
        | "resale"
        | "manufacturing_input"
        | "internal_use"
        | "consumable"
      movement_type:
        | "purchase"
        | "sale"
        | "adjustment"
        | "reconciliation"
        | "consumption"
        | "received"
        | "assembled"
      po_status:
        | "draft"
        | "submitted"
        | "approved"
        | "ordered"
        | "received"
        | "closed"
      so_status:
        | "quote"
        | "order"
        | "fulfilled"
        | "invoiced"
        | "paid"
        | "closed"
      source_type:
        | "purchase_order"
        | "sales_order"
        | "reconciliation"
        | "assembly_record"
        | "manual"
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
    Enums: {
      app_role: ["admin", "procurement", "sales", "finance", "employee"],
      inventory_type: [
        "resale",
        "manufacturing_input",
        "internal_use",
        "consumable",
      ],
      movement_type: [
        "purchase",
        "sale",
        "adjustment",
        "reconciliation",
        "consumption",
        "received",
        "assembled",
      ],
      po_status: [
        "draft",
        "submitted",
        "approved",
        "ordered",
        "received",
        "closed",
      ],
      so_status: ["quote", "order", "fulfilled", "invoiced", "paid", "closed"],
      source_type: [
        "purchase_order",
        "sales_order",
        "reconciliation",
        "assembly_record",
        "manual",
      ],
    },
  },
} as const
