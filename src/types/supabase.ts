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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      aid_claims: {
        Row: {
          amount_cents_applied: number
          created_at: string
          handled_at: string | null
          handled_by_user_id: string | null
          id: string
          order_item_id: string
          reference: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount_cents_applied?: number
          created_at?: string
          handled_at?: string | null
          handled_by_user_id?: string | null
          id?: string
          order_item_id: string
          reference?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount_cents_applied?: number
          created_at?: string
          handled_at?: string | null
          handled_by_user_id?: string | null
          id?: string
          order_item_id?: string
          reference?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aid_claims_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          diff: Json
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          collectivity_id: string | null
          created_at: string
          full_name: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          collectivity_id?: string | null
          created_at?: string
          full_name?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          collectivity_id?: string | null
          created_at?: string
          full_name?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_collectivity_id_fkey"
            columns: ["collectivity_id"]
            isOneToOne: false
            referencedRelation: "collectivities"
            referencedColumns: ["id"]
          },
        ]
      }
      collectivities: {
        Row: {
          code: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          offer_mode: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          offer_mode?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          offer_mode?: string
        }
        Relationships: []
      }
      collectivity_contributions: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          cap_cents: number | null
          collectivity_id: string
          created_at: string
          fixed_cents: number | null
          id: string
          mode: string
          order_item_id: string
          percent_value: number | null
          status: Database["public"]["Enums"]["contribution_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          cap_cents?: number | null
          collectivity_id: string
          created_at?: string
          fixed_cents?: number | null
          id?: string
          mode: string
          order_item_id: string
          percent_value?: number | null
          status?: Database["public"]["Enums"]["contribution_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          cap_cents?: number | null
          collectivity_id?: string
          created_at?: string
          fixed_cents?: number | null
          id?: string
          mode?: string
          order_item_id?: string
          percent_value?: number | null
          status?: Database["public"]["Enums"]["contribution_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collectivity_contributions_collectivity_id_fkey"
            columns: ["collectivity_id"]
            isOneToOne: false
            referencedRelation: "collectivities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collectivity_contributions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      collectivity_members: {
        Row: {
          collectivity_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          collectivity_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          collectivity_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collectivity_members_collectivity_id_fkey"
            columns: ["collectivity_id"]
            isOneToOne: false
            referencedRelation: "collectivities"
            referencedColumns: ["id"]
          },
        ]
      }
      collectivity_stay_exclusions: {
        Row: {
          collectivity_id: string
          created_at: string
          id: string
          stay_id: string
        }
        Insert: {
          collectivity_id: string
          created_at?: string
          id?: string
          stay_id: string
        }
        Update: {
          collectivity_id?: string
          created_at?: string
          id?: string
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collectivity_stay_exclusions_collectivity_id_fkey"
            columns: ["collectivity_id"]
            isOneToOne: false
            referencedRelation: "collectivities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collectivity_stay_exclusions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          number: number
          pdf_url: string | null
          total_cents: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          number: number
          pdf_url?: string | null
          total_cents?: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          number?: number
          pdf_url?: string | null
          total_cents?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_options: {
        Row: {
          amount_cents: number | null
          created_at: string
          id: string
          label: string
          percent_value: number | null
          pricing_mode: string
          rules_json: Json
          session_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          id?: string
          label: string
          percent_value?: number | null
          pricing_mode: string
          rules_json?: Json
          session_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          id?: string
          label?: string
          percent_value?: number | null
          pricing_mode?: string
          rules_json?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_options_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          next_number: number
          year: number
        }
        Insert: {
          next_number: number
          year: number
        }
        Update: {
          next_number?: number
          year?: number
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          invoice_id: string
          label: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          invoice_id: string
          label: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          invoice_id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_user_id: string | null
          collectivity_id: string | null
          created_at: string
          id: string
          invoice_type: string
          issued_at: string | null
          number: number
          order_id: string | null
          organizer_id: string | null
          pdf_url: string | null
          status: string
          total_cents: number
          year: number
        }
        Insert: {
          client_user_id?: string | null
          collectivity_id?: string | null
          created_at?: string
          id?: string
          invoice_type: string
          issued_at?: string | null
          number: number
          order_id?: string | null
          organizer_id?: string | null
          pdf_url?: string | null
          status?: string
          total_cents?: number
          year: number
        }
        Update: {
          client_user_id?: string | null
          collectivity_id?: string | null
          created_at?: string
          id?: string
          invoice_type?: string
          issued_at?: string | null
          number?: number
          order_id?: string | null
          organizer_id?: string | null
          pdf_url?: string | null
          status?: string
          total_cents?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_collectivity_id_fkey"
            columns: ["collectivity_id"]
            isOneToOne: false
            referencedRelation: "collectivities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_extra_options: {
        Row: {
          amount_cents_snapshot: number
          created_at: string
          id: string
          label_snapshot: string
          order_item_id: string
          stay_extra_option_id: string
        }
        Insert: {
          amount_cents_snapshot: number
          created_at?: string
          id?: string
          label_snapshot: string
          order_item_id: string
          stay_extra_option_id: string
        }
        Update: {
          amount_cents_snapshot?: number
          created_at?: string
          id?: string
          label_snapshot?: string
          order_item_id?: string
          stay_extra_option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_extra_options_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_extra_options_stay_extra_option_id_fkey"
            columns: ["stay_extra_option_id"]
            isOneToOne: false
            referencedRelation: "stay_extra_options"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          base_price_cents: number
          child_birthdate: string
          child_first_name: string
          child_last_name: string
          created_at: string
          id: string
          insurance_option_id: string | null
          options_price_cents: number
          order_id: string
          organizer_id: string
          session_id: string
          status: string
          total_price_cents: number
          transport_option_id: string | null
          updated_at: string
        }
        Insert: {
          base_price_cents?: number
          child_birthdate: string
          child_first_name: string
          child_last_name: string
          created_at?: string
          id?: string
          insurance_option_id?: string | null
          options_price_cents?: number
          order_id: string
          organizer_id: string
          session_id: string
          status?: string
          total_price_cents?: number
          transport_option_id?: string | null
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          child_birthdate?: string
          child_first_name?: string
          child_last_name?: string
          created_at?: string
          id?: string
          insurance_option_id?: string | null
          options_price_cents?: number
          order_id?: string
          organizer_id?: string
          session_id?: string
          status?: string
          total_price_cents?: number
          transport_option_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_insurance_option_id_fkey"
            columns: ["insurance_option_id"]
            isOneToOne: false
            referencedRelation: "insurance_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_transport_option_id_fkey"
            columns: ["transport_option_id"]
            isOneToOne: false
            referencedRelation: "transport_options"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          booked_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          client_user_id: string
          collectivity_id: string | null
          created_at: string
          id: string
          paid_at: string | null
          requested_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          validated_at: string | null
          validated_by_user_id: string | null
        }
        Insert: {
          booked_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_user_id: string
          collectivity_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
        }
        Update: {
          booked_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_user_id?: string
          collectivity_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_collectivity_id_fkey"
            columns: ["collectivity_id"]
            isOneToOne: false
            referencedRelation: "collectivities"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_members: {
        Row: {
          created_at: string
          id: string
          organizer_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organizer_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organizer_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
        ]
      }
      organizers: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      payment_installments: {
        Row: {
          amount_cents: number
          created_at: string
          due_at: string
          id: string
          installment_no: number
          payment_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          due_at: string
          id?: string
          installment_no: number
          payment_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          due_at?: string
          id?: string
          installment_no?: number
          payment_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          monetico_reference: string | null
          monetico_transaction_id: string | null
          order_id: string
          plan: string
          provider: string
          raw_payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          monetico_reference?: string | null
          monetico_transaction_id?: string | null
          order_id: string
          plan?: string
          provider?: string
          raw_payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          monetico_reference?: string | null
          monetico_transaction_id?: string | null
          order_id?: string
          plan?: string
          provider?: string
          raw_payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
        }
        Relationships: []
      }
      session_holds: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          order_item_id: string
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          order_item_id: string
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          order_item_id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_holds_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_holds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_prices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          session_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          session_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_prices_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          capacity_reserved: number
          capacity_total: number
          created_at: string
          end_date: string
          id: string
          start_date: string
          status: Database["public"]["Enums"]["session_status"]
          stay_id: string
          updated_at: string
        }
        Insert: {
          capacity_reserved?: number
          capacity_total: number
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          status?: Database["public"]["Enums"]["session_status"]
          stay_id: string
          updated_at?: string
        }
        Update: {
          capacity_reserved?: number
          capacity_total?: number
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["session_status"]
          stay_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_users: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      stay_extra_options: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          label: string
          position: number
          stay_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          label: string
          position: number
          stay_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          label?: string
          position?: number
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_extra_options_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          position: number
          stay_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type?: string
          position?: number
          stay_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          position?: number
          stay_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_media_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      stays: {
        Row: {
          age_max: number | null
          age_min: number | null
          archive_at: string | null
          created_at: string
          description: string | null
          id: string
          location_text: string | null
          organizer_id: string
          season_id: string
          status: Database["public"]["Enums"]["stay_status"]
          title: string
          transport_mode: string
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          archive_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_text?: string | null
          organizer_id: string
          season_id: string
          status?: Database["public"]["Enums"]["stay_status"]
          title: string
          transport_mode?: string
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          archive_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_text?: string | null
          organizer_id?: string
          season_id?: string
          status?: Database["public"]["Enums"]["stay_status"]
          title?: string
          transport_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stays_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_options: {
        Row: {
          amount_cents: number
          created_at: string
          departure_city: string
          id: string
          return_city: string
          session_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          departure_city: string
          id?: string
          return_city: string
          session_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          departure_city?: string
          id?: string
          return_city?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_options_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cron_archive_finished_stays: { Args: never; Returns: undefined }
      cron_complete_sessions: { Args: never; Returns: undefined }
      cron_expire_holds: { Args: never; Returns: undefined }
      next_invoice_number: { Args: { p_year: number }; Returns: number }
    }
    Enums: {
      contribution_status: "PENDING" | "APPROVED" | "REJECTED"
      hold_status: "ACTIVE" | "CONVERTED" | "RELEASED" | "EXPIRED"
      order_status:
        | "CART"
        | "REQUESTED"
        | "VALIDATED"
        | "BOOKED"
        | "PAID"
        | "CONFIRMED"
        | "CANCELLED"
      session_status: "OPEN" | "FULL" | "COMPLETED" | "ARCHIVED"
      stay_status: "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED"
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
      contribution_status: ["PENDING", "APPROVED", "REJECTED"],
      hold_status: ["ACTIVE", "CONVERTED", "RELEASED", "EXPIRED"],
      order_status: [
        "CART",
        "REQUESTED",
        "VALIDATED",
        "BOOKED",
        "PAID",
        "CONFIRMED",
        "CANCELLED",
      ],
      session_status: ["OPEN", "FULL", "COMPLETED", "ARCHIVED"],
      stay_status: ["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"],
    },
  },
} as const
