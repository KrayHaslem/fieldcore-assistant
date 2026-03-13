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
      bill_of_materials: {
        Row: {
          component_item_id: string
          created_at: string
          finished_item_id: string
          id: string
          notes: string | null
          organization_id: string
          quantity_per_unit: number
          updated_at: string
        }
        Insert: {
          component_item_id: string
          created_at?: string
          finished_item_id: string
          id?: string
          notes?: string | null
          organization_id: string
          quantity_per_unit?: number
          updated_at?: string
        }
        Update: {
          component_item_id?: string
          created_at?: string
          finished_item_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          quantity_per_unit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_finished_item_id_fkey"
            columns: ["finished_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_organization_id_fkey"
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
      customers: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
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
          avg_unit_cost: number | null
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
          avg_unit_cost?: number | null
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
          avg_unit_cost?: number | null
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
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          roles: string[]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          roles?: string[]
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          roles?: string[]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
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
          is_onboarded: boolean
          name: string
          settings: Json | null
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          is_onboarded?: boolean
          name: string
          settings?: Json | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          is_onboarded?: boolean
          name?: string
          settings?: Json | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      po_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          organization_id: string
          po_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          organization_id: string
          po_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          organization_id?: string
          po_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
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
          shortfall_notes: string | null
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
          shortfall_notes?: string | null
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
          shortfall_notes?: string | null
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
          assigned_approver_id: string | null
          created_at: string
          created_by: string
          department_id: string | null
          has_shortfall: boolean
          id: string
          notes: string | null
          ordered_at: string | null
          organization_id: string
          po_group_id: string | null
          po_number: string
          received_at: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_notes: string | null
          required_approver_role: string | null
          rule_is_department_scoped: boolean | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_approver_id?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          has_shortfall?: boolean
          id?: string
          notes?: string | null
          ordered_at?: string | null
          organization_id: string
          po_group_id?: string | null
          po_number: string
          received_at?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_notes?: string | null
          required_approver_role?: string | null
          rule_is_department_scoped?: boolean | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_approver_id?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          has_shortfall?: boolean
          id?: string
          notes?: string | null
          ordered_at?: string | null
          organization_id?: string
          po_group_id?: string | null
          po_number?: string
          received_at?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_notes?: string | null
          required_approver_role?: string | null
          rule_is_department_scoped?: boolean | null
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
            foreignKeyName: "purchase_orders_po_group_id_fkey"
            columns: ["po_group_id"]
            isOneToOne: false
            referencedRelation: "po_groups"
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
          source_template_id: string | null
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
          source_template_id?: string | null
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
          source_template_id?: string | null
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
          {
            foreignKeyName: "report_templates_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          cost_per_unit: number
          created_at: string
          id: string
          item_id: string
          organization_id: string
          quantity: number
          sales_order_id: string
          unit_price: number
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          item_id: string
          organization_id: string
          quantity: number
          sales_order_id: string
          unit_price: number
        }
        Update: {
          cost_per_unit?: number
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
          customer_id: string | null
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
          customer_id?: string | null
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
          customer_id?: string | null
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
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
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
      user_preferences: {
        Row: {
          active_organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_active_organization_id_fkey"
            columns: ["active_organization_id"]
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
      can_insert_profile: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      create_onboarding_org: {
        Args: {
          _email: string
          _full_name: string
          _org_name: string
          _user_id: string
        }
        Returns: string
      }
      get_approval_rule: {
        Args: { _department_id: string; _org_id: string; _total_amount: number }
        Returns: {
          approver_user_id: string
          auto_approve: boolean
          required_role: string
          rule_is_department_scoped: boolean
        }[]
      }
      get_component_stock: {
        Args: { _item_ids: string[]; _org_id: string }
        Returns: {
          item_id: string
          on_hand: number
        }[]
      }
      get_low_stock_items: {
        Args: { _org_id: string }
        Returns: {
          current_stock: number
          id: string
          name: string
          reorder_point: number
          sku: string
        }[]
      }
      get_margin_by_item: {
        Args: { _end_date: string; _start_date: string; _user_id: string }
        Returns: {
          cogs: number
          gross_margin: number
          item_name: string
          margin_pct: number
          revenue: number
          units_sold: number
        }[]
      }
      get_margins_by_timeframe: {
        Args: {
          _end_date: string
          _grouping: string
          _start_date: string
          _user_id: string
        }
        Returns: {
          cogs: number
          gross_margin: number
          margin_pct: number
          period: string
          revenue: number
        }[]
      }
      get_my_approval_queue: {
        Args: { _user_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          assigned_approver_id: string | null
          created_at: string
          created_by: string
          department_id: string | null
          has_shortfall: boolean
          id: string
          notes: string | null
          ordered_at: string | null
          organization_id: string
          po_group_id: string | null
          po_number: string
          received_at: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_notes: string | null
          required_approver_role: string | null
          rule_is_department_scoped: boolean | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string | null
          total_amount: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "purchase_orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_quarterly_revenue: {
        Args: { _end_date: string; _start_date: string; _user_id: string }
        Returns: {
          quarter: string
          total: number
        }[]
      }
      get_sales_by_item: {
        Args: { _end_date: string; _start_date: string; _user_id: string }
        Returns: {
          item_name: string
          revenue: number
          units_sold: number
        }[]
      }
      get_sales_by_salesperson: {
        Args: { _end_date: string; _start_date: string; _user_id: string }
        Returns: {
          order_count: number
          salesperson_name: string
          total_revenue: number
        }[]
      }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_all_organizations: {
        Args: never
        Returns: {
          created_at: string
          id: string
          industry: string
          name: string
        }[]
      }
      update_item_avg_cost: { Args: { _item_id: string }; Returns: undefined }
      update_supplier_lead_time: {
        Args: { _supplier_id: string }
        Returns: undefined
      }
      update_user_roles: {
        Args: {
          _new_roles: Database["public"]["Enums"]["app_role"][]
          _organization_id: string
          _target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "procurement"
        | "sales"
        | "finance"
        | "employee"
        | "superadmin"
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
        | "partially_received"
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
      app_role: [
        "admin",
        "procurement",
        "sales",
        "finance",
        "employee",
        "superadmin",
      ],
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
        "partially_received",
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
