
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"created_at": string,"data": NonNullable<Json>,"entity": string,"entity_id": string | null,"group_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"entity": string,"entity_id"?: string | null,"group_id": string,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string | null,"group_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"cycle_rules": {
                  Row: {
                    "created_at": string,"cycle_id": string,"excess_rate": number,"loan_multiples": NonNullable<Json>,"loan_rate": number,"membership_fee": number,"min_saving": number,"penalty_per_day": number,"tenor_bands": NonNullable<Json>,"window_close_day": number,"window_open_day": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cycle_id": string,"excess_rate"?: number,"loan_multiples": NonNullable<Json>,"loan_rate"?: number,"membership_fee"?: number,"min_saving"?: number,"penalty_per_day"?: number,"tenor_bands": NonNullable<Json>,"window_close_day"?: number,"window_open_day"?: number
                  }
                  Update: {
                    "created_at"?: string,"cycle_id"?: string,"excess_rate"?: number,"loan_multiples"?: NonNullable<Json>,"loan_rate"?: number,"membership_fee"?: number,"min_saving"?: number,"penalty_per_day"?: number,"tenor_bands"?: NonNullable<Json>,"window_close_day"?: number,"window_open_day"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cycle_rules_cycle_id_fkey"
      columns: ["cycle_id"]
isOneToOne: true
      referencedRelation: "cycles"
      referencedColumns: ["id"]
    }
                  ]
                },"cycles": {
                  Row: {
                    "created_at": string,"ends_on": string,"group_id": string,"id": string,"label": string,"payout_on": string,"starts_on": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_on": string,"group_id": string,"id"?: string,"label": string,"payout_on": string,"starts_on": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string,"group_id"?: string,"id"?: string,"label"?: string,"payout_on"?: string,"starts_on"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cycles_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"declarations": {
                  Row: {
                    "borrowing_request": number,"created_at": string,"decided_at": string | null,"decided_by": string | null,"excess": number,"group_id": string,"id": string,"loan_repayment": number,"member_id": string,"membership": number,"note": string | null,"penalty": number,"period_id": string,"return_reason": string | null,"saving": number,"status": string,"submitted_at": string,"submitted_by": string | null,"supersedes_id": string | null,"txn_fee": number,"wallet_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "borrowing_request"?: number,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"excess"?: number,"group_id": string,"id"?: string,"loan_repayment"?: number,"member_id": string,"membership"?: number,"note"?: string | null,"penalty"?: number,"period_id": string,"return_reason"?: string | null,"saving"?: number,"status"?: string,"submitted_at"?: string,"submitted_by"?: string | null,"supersedes_id"?: string | null,"txn_fee"?: number,"wallet_id"?: string | null
                  }
                  Update: {
                    "borrowing_request"?: number,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"excess"?: number,"group_id"?: string,"id"?: string,"loan_repayment"?: number,"member_id"?: string,"membership"?: number,"note"?: string | null,"penalty"?: number,"period_id"?: string,"return_reason"?: string | null,"saving"?: number,"status"?: string,"submitted_at"?: string,"submitted_by"?: string | null,"supersedes_id"?: string | null,"txn_fee"?: number,"wallet_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "declarations_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "declarations_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "declarations_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "declarations_period_id_group_id_fkey"
      columns: ["period_id","group_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "declarations_supersedes_id_group_fkey"
      columns: ["supersedes_id","group_id"]
isOneToOne: false
      referencedRelation: "declarations"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "declarations_wallet_id_group_id_fkey"
      columns: ["wallet_id","group_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"entries": {
                  Row: {
                    "amount": number,"corrects_entry_id": string | null,"created_at": string,"created_by": string | null,"declaration_id": string | null,"group_id": string,"id": string,"kind": string,"loan_id": string | null,"member_id": string | null,"period_id": string,"reason": string | null,"source": string,"wallet_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"corrects_entry_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"declaration_id"?: string | null,"group_id": string,"id"?: string,"kind": string,"loan_id"?: string | null,"member_id"?: string | null,"period_id": string,"reason"?: string | null,"source": string,"wallet_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"corrects_entry_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"declaration_id"?: string | null,"group_id"?: string,"id"?: string,"kind"?: string,"loan_id"?: string | null,"member_id"?: string | null,"period_id"?: string,"reason"?: string | null,"source"?: string,"wallet_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "entries_corrects_entry_id_group_fkey"
      columns: ["corrects_entry_id","group_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "entries_declaration_id_group_id_fkey"
      columns: ["declaration_id","group_id"]
isOneToOne: false
      referencedRelation: "declarations"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "entries_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entries_loan_id_group_id_fkey"
      columns: ["loan_id","group_id"]
isOneToOne: false
      referencedRelation: "loans"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "entries_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "entries_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "entries_period_id_group_id_fkey"
      columns: ["period_id","group_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "entries_wallet_id_group_id_fkey"
      columns: ["wallet_id","group_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"group_statements": {
                  Row: {
                    "created_at": string,"excess_billed": number,"excess_rate": number,"fee_pot_balance": number,"fee_pot_in": number,"fee_pot_out": number,"group_id": string,"id": string,"idle_cash": number,"interest_collected": number,"loans_sent": number,"meeting_pot_balance": number,"meeting_pot_in": number,"opening_cash": number,"period_id": string,"received": number,"savings": number,"source": string,"total_owed": number,"total_savings": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"excess_billed"?: number,"excess_rate": number,"fee_pot_balance"?: number,"fee_pot_in"?: number,"fee_pot_out"?: number,"group_id": string,"id"?: string,"idle_cash"?: number,"interest_collected"?: number,"loans_sent"?: number,"meeting_pot_balance"?: number,"meeting_pot_in"?: number,"opening_cash"?: number,"period_id": string,"received"?: number,"savings"?: number,"source": string,"total_owed"?: number,"total_savings"?: number
                  }
                  Update: {
                    "created_at"?: string,"excess_billed"?: number,"excess_rate"?: number,"fee_pot_balance"?: number,"fee_pot_in"?: number,"fee_pot_out"?: number,"group_id"?: string,"id"?: string,"idle_cash"?: number,"interest_collected"?: number,"loans_sent"?: number,"meeting_pot_balance"?: number,"meeting_pot_in"?: number,"opening_cash"?: number,"period_id"?: string,"received"?: number,"savings"?: number,"source"?: string,"total_owed"?: number,"total_savings"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_statements_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_statements_period_id_group_id_fkey"
      columns: ["period_id","group_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "created_at": string,"currency": string,"figures_visibility": string,"id": string,"name": string,"owner_user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"figures_visibility"?: string,"id"?: string,"name": string,"owner_user_id": string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"figures_visibility"?: string,"id"?: string,"name"?: string,"owner_user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"created_by": string,"email": string,"expires_at": string,"group_id": string,"id": string,"member_id": string,"revoked_at": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by": string,"email": string,"expires_at": string,"group_id": string,"id"?: string,"member_id": string,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by"?: string,"email"?: string,"expires_at"?: string,"group_id"?: string,"id"?: string,"member_id"?: string,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"loan_instalments": {
                  Row: {
                    "amount_due": number,"created_at": string,"group_id": string,"id": string,"loan_id": string,"period_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_due": number,"created_at"?: string,"group_id": string,"id"?: string,"loan_id": string,"period_id": string
                  }
                  Update: {
                    "amount_due"?: number,"created_at"?: string,"group_id"?: string,"id"?: string,"loan_id"?: string,"period_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loan_instalments_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "loan_instalments_loan_id_group_id_fkey"
      columns: ["loan_id","group_id"]
isOneToOne: false
      referencedRelation: "loans"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "loan_instalments_period_id_group_id_fkey"
      columns: ["period_id","group_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"loans": {
                  Row: {
                    "approved_reason": string | null,"arrears_warning": string | null,"cap_warning": string | null,"created_at": string,"group_id": string,"id": string,"interest": number,"member_id": string,"period_id": string,"principal": number,"sent_at": string,"status": string,"term_months": number,"wallet_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_reason"?: string | null,"arrears_warning"?: string | null,"cap_warning"?: string | null,"created_at"?: string,"group_id": string,"id"?: string,"interest": number,"member_id": string,"period_id": string,"principal": number,"sent_at"?: string,"status"?: string,"term_months": number,"wallet_id"?: string | null
                  }
                  Update: {
                    "approved_reason"?: string | null,"arrears_warning"?: string | null,"cap_warning"?: string | null,"created_at"?: string,"group_id"?: string,"id"?: string,"interest"?: number,"member_id"?: string,"period_id"?: string,"principal"?: number,"sent_at"?: string,"status"?: string,"term_months"?: number,"wallet_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "loans_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "loans_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "loans_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "loans_period_id_group_id_fkey"
      columns: ["period_id","group_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "loans_wallet_id_group_id_fkey"
      columns: ["wallet_id","group_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"member_status": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"created_at": string,"cycle_id": string,"defaulted": boolean,"group_id": string,"id": string,"member_id": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"created_at"?: string,"cycle_id": string,"defaulted"?: boolean,"group_id": string,"id"?: string,"member_id": string,"reason": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"created_at"?: string,"cycle_id"?: string,"defaulted"?: boolean,"group_id"?: string,"id"?: string,"member_id"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_status_cycle_id_group_id_fkey"
      columns: ["cycle_id","group_id"]
isOneToOne: false
      referencedRelation: "cycles"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "member_status_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_status_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "member_status_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"members": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"group_id": string,"id": string,"joined_on": string,"phone": string | null,"role": string,"short_name": string,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"group_id": string,"id"?: string,"joined_on"?: string,"phone"?: string | null,"role"?: string,"short_name": string,"status"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"group_id"?: string,"id"?: string,"joined_on"?: string,"phone"?: string | null,"role"?: string,"short_name"?: string,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"periods": {
                  Row: {
                    "closed_at": string | null,"closed_by": string | null,"created_at": string,"cycle_id": string,"deadline": string,"group_id": string,"id": string,"label": string,"month_index": number,"starts_on": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"cycle_id": string,"deadline": string,"group_id": string,"id"?: string,"label": string,"month_index": number,"starts_on": string,"status"?: string
                  }
                  Update: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"cycle_id"?: string,"deadline"?: string,"group_id"?: string,"id"?: string,"label"?: string,"month_index"?: number,"starts_on"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "periods_cycle_id_group_id_fkey"
      columns: ["cycle_id","group_id"]
isOneToOne: false
      referencedRelation: "cycles"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "periods_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"statements": {
                  Row: {
                    "closing_owed": number,"created_at": string,"cum_savings": number,"excess_charged": number,"group_id": string,"id": string,"interest_earned": number,"interest_earned_to_date": number,"loan_interest_charged": number,"loan_principal_sent": number,"member_id": string,"next_minimum": number,"opening_owed": number,"paid_to_excess": number,"paid_to_interest": number,"paid_to_penalties": number,"paid_to_principal": number,"paid_total": number,"penalties_charged": number,"period_id": string,"saving": number,"source": string,"unpaid_minimum": number
                  }
                  ComputedFields: never
                  Insert: {
                    "closing_owed"?: number,"created_at"?: string,"cum_savings"?: number,"excess_charged"?: number,"group_id": string,"id"?: string,"interest_earned"?: number,"interest_earned_to_date"?: number,"loan_interest_charged"?: number,"loan_principal_sent"?: number,"member_id": string,"next_minimum"?: number,"opening_owed"?: number,"paid_to_excess"?: number,"paid_to_interest"?: number,"paid_to_penalties"?: number,"paid_to_principal"?: number,"paid_total"?: number,"penalties_charged"?: number,"period_id": string,"saving"?: number,"source": string,"unpaid_minimum"?: number
                  }
                  Update: {
                    "closing_owed"?: number,"created_at"?: string,"cum_savings"?: number,"excess_charged"?: number,"group_id"?: string,"id"?: string,"interest_earned"?: number,"interest_earned_to_date"?: number,"loan_interest_charged"?: number,"loan_principal_sent"?: number,"member_id"?: string,"next_minimum"?: number,"opening_owed"?: number,"paid_to_excess"?: number,"paid_to_interest"?: number,"paid_to_penalties"?: number,"paid_to_principal"?: number,"paid_total"?: number,"penalties_charged"?: number,"period_id"?: string,"saving"?: number,"source"?: string,"unpaid_minimum"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "statements_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "statements_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "statements_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "statements_period_id_group_id_fkey"
      columns: ["period_id","group_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"wallets": {
                  Row: {
                    "active": boolean,"created_at": string,"group_id": string,"holder_member_id": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"group_id": string,"holder_member_id"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"group_id"?: string,"holder_member_id"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wallets_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wallets_holder_member_id_group_id_fkey"
      columns: ["holder_member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "wallets_holder_member_id_group_id_fkey"
      columns: ["holder_member_id","group_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","group_id"]
    }
                  ]
                },"workbook_figures": {
                  Row: {
                    "created_at": string,"field": string,"group_id": string,"id": string,"member_id": string | null,"period_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"field": string,"group_id": string,"id"?: string,"member_id"?: string | null,"period_id": string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"field"?: string,"group_id"?: string,"id"?: string,"member_id"?: string | null,"period_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "workbook_figures_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workbook_figures_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "group_members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "workbook_figures_member_id_group_id_fkey"
      columns: ["member_id","group_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "workbook_figures_period_id_group_id_fkey"
      columns: ["period_id","group_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["id","group_id"]
    }
                  ]
                }
          }
          Views: {
            "group_members": {
                  Row: {
                    "full_name": string | null,"group_id": string | null,"id": string | null,"linked": boolean | null,"role": string | null,"short_name": string | null,"status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "full_name"?: string | null,"group_id"?: string | null,"id"?: string | null,"linked"?: never,"role"?: string | null,"short_name"?: string | null,"status"?: string | null
                         }
                        Update: {
                           "full_name"?: string | null,"group_id"?: string | null,"id"?: string | null,"linked"?: never,"role"?: string | null,"short_name"?: string | null,"status"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_invite":
{ Args: { "p_token": string }; Returns: {
              "created_at": string,
"email": string | null,
"full_name": string,
"group_id": string,
"id": string,
"joined_on": string,
"phone": string | null,
"role": string,
"short_name": string,
"status": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "members"
        isOneToOne: true
        isSetofReturn: false
      } },
"apply_penalty":
{ Args: { "p_amount": number,"p_ground": string,"p_member": string,"p_period": string,"p_reason": string }; Returns: {
              "amount": number,
"corrects_entry_id": string | null,
"created_at": string,
"created_by": string | null,
"declaration_id": string | null,
"group_id": string,
"id": string,
"kind": string,
"loan_id": string | null,
"member_id": string | null,
"period_id": string,
"reason": string | null,
"source": string,
"wallet_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "entries"
        isOneToOne: true
        isSetofReturn: false
      } },
"approve_declaration":
{ Args: { "p_declaration": string }; Returns: {
              "borrowing_request": number,
"created_at": string,
"decided_at": string | null,
"decided_by": string | null,
"excess": number,
"group_id": string,
"id": string,
"loan_repayment": number,
"member_id": string,
"membership": number,
"note": string | null,
"penalty": number,
"period_id": string,
"return_reason": string | null,
"saving": number,
"status": string,
"submitted_at": string,
"submitted_by": string | null,
"supersedes_id": string | null,
"txn_fee": number,
"wallet_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "declarations"
        isOneToOne: true
        isSetofReturn: false
      } },
"can_see_figures":
{ Args: { "p_group_id": string,"p_member_id": string }; Returns: boolean
                           },
"close_month":
{ Args: { "p_commit"?: boolean,"p_period": string,"p_reason"?: string }; Returns: Json
                           },
"create_group":
{ Args: { "p_currency": string,"p_full_name": string,"p_name": string,"p_short_name": string }; Returns: string
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: Json
                           },
"is_admin":
{ Args: { "p_group_id": string }; Returns: boolean
                           },
"is_member":
{ Args: { "p_group_id": string }; Returns: boolean
                           },
"ledger_check":
{ Args: { "p_group": string }; Returns: Json
                           },
"open_period":
{ Args: { "p_cycle": string,"p_deadline"?: string,"p_month_index": number }; Returns: {
              "closed_at": string | null,
"closed_by": string | null,
"created_at": string,
"cycle_id": string,
"deadline": string,
"group_id": string,
"id": string,
"label": string,
"month_index": number,
"starts_on": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "periods"
        isOneToOne: true
        isSetofReturn: false
      } },
"payout_preview":
{ Args: { "p_cycle": string }; Returns: {
              "interest_earned": number,"member_id": string,"owed": number,"payout": number,"pot_share": number,"savings": number,"short_name": string
            }[]
                           },
"post_correction":
{ Args: { "p_entry": string,"p_new_amount": number,"p_reason": string }; Returns: {
              "amount": number,
"corrects_entry_id": string | null,
"created_at": string,
"created_by": string | null,
"declaration_id": string | null,
"group_id": string,
"id": string,
"kind": string,
"loan_id": string | null,
"member_id": string | null,
"period_id": string,
"reason": string | null,
"source": string,
"wallet_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "entries"
        isOneToOne: true
        isSetofReturn: false
      } },
"post_waiver":
{ Args: { "p_amount": number,"p_entry": string,"p_reason": string }; Returns: {
              "amount": number,
"corrects_entry_id": string | null,
"created_at": string,
"created_by": string | null,
"declaration_id": string | null,
"group_id": string,
"id": string,
"kind": string,
"loan_id": string | null,
"member_id": string | null,
"period_id": string,
"reason": string | null,
"source": string,
"wallet_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "entries"
        isOneToOne: true
        isSetofReturn: false
      } },
"return_declaration":
{ Args: { "p_declaration": string,"p_reason": string }; Returns: {
              "borrowing_request": number,
"created_at": string,
"decided_at": string | null,
"decided_by": string | null,
"excess": number,
"group_id": string,
"id": string,
"loan_repayment": number,
"member_id": string,
"membership": number,
"note": string | null,
"penalty": number,
"period_id": string,
"return_reason": string | null,
"saving": number,
"status": string,
"submitted_at": string,
"submitted_by": string | null,
"supersedes_id": string | null,
"txn_fee": number,
"wallet_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "declarations"
        isOneToOne: true
        isSetofReturn: false
      } },
"send_loan":
{ Args: { "p_fee"?: number,"p_member": string,"p_principal": number,"p_reason"?: string,"p_wallet": string }; Returns: {
              "approved_reason": string | null,
"arrears_warning": string | null,
"cap_warning": string | null,
"created_at": string,
"group_id": string,
"id": string,
"interest": number,
"member_id": string,
"period_id": string,
"principal": number,
"sent_at": string,
"status": string,
"term_months": number,
"wallet_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "loans"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_admin":
{ Args: { "p_make_admin": boolean,"p_member_id": string }; Returns: {
              "created_at": string,
"email": string | null,
"full_name": string,
"group_id": string,
"id": string,
"joined_on": string,
"phone": string | null,
"role": string,
"short_name": string,
"status": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "members"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_deadline":
{ Args: { "p_deadline": string,"p_period": string,"p_reason": string }; Returns: {
              "closed_at": string | null,
"closed_by": string | null,
"created_at": string,
"cycle_id": string,
"deadline": string,
"group_id": string,
"id": string,
"label": string,
"month_index": number,
"starts_on": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "periods"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_default":
{ Args: { "p_cycle": string,"p_defaulted": boolean,"p_member": string,"p_reason": string }; Returns: {
              "changed_at": string,
"changed_by": string | null,
"created_at": string,
"cycle_id": string,
"defaulted": boolean,
"group_id": string,
"id": string,
"member_id": string,
"reason": string
            }
                          SetofOptions: {
        from: "*"
        to: "member_status"
        isOneToOne: true
        isSetofReturn: false
      } },
"submit_declaration":
{ Args: { "p_borrowing_request"?: number,"p_excess"?: number,"p_loan_repayment"?: number,"p_member": string,"p_membership"?: number,"p_note"?: string,"p_penalty"?: number,"p_period": string,"p_saving"?: number,"p_txn_fee"?: number,"p_wallet"?: string }; Returns: {
              "borrowing_request": number,
"created_at": string,
"decided_at": string | null,
"decided_by": string | null,
"excess": number,
"group_id": string,
"id": string,
"loan_repayment": number,
"member_id": string,
"membership": number,
"note": string | null,
"penalty": number,
"period_id": string,
"return_reason": string | null,
"saving": number,
"status": string,
"submitted_at": string,
"submitted_by": string | null,
"supersedes_id": string | null,
"txn_fee": number,
"wallet_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "declarations"
        isOneToOne: true
        isSetofReturn: false
      } },
"suggest_penalties":
{ Args: { "p_period": string }; Returns: {
              "amount": number,"detail": string,"ground": string,"member_id": string,"short_name": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
