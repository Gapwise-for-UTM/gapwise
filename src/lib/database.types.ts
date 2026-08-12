// Generated from the connected Supabase project after Gate 6 plaintext retirement.
// Regenerate after any later hosted schema change.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      crypto_key_envelopes: {
        Row: {
          created_at: string;
          crypto_version: number;
          friend_availability_key_id: string;
          friend_availability_wrap_nonce: string;
          friend_availability_wrapped_dek: string;
          kek_version: number;
          key_version: number;
          private_data_key_id: string;
          private_data_wrap_nonce: string;
          private_data_wrapped_dek: string;
          subject_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          crypto_version?: number;
          friend_availability_key_id?: string;
          friend_availability_wrap_nonce: string;
          friend_availability_wrapped_dek: string;
          kek_version: number;
          key_version?: number;
          private_data_key_id?: string;
          private_data_wrap_nonce: string;
          private_data_wrapped_dek: string;
          subject_id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          crypto_version?: number;
          friend_availability_key_id?: string;
          friend_availability_wrap_nonce?: string;
          friend_availability_wrapped_dek?: string;
          kek_version?: number;
          key_version?: number;
          private_data_key_id?: string;
          private_data_wrap_nonce?: string;
          private_data_wrapped_dek?: string;
          subject_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      encrypted_friend_availability: {
        Row: {
          capsule_id: string;
          ciphertext: string;
          crypto_version: number;
          key_id: string;
          nonce: string;
          revision: number;
          schema_version: number;
          subject_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          capsule_id?: string;
          ciphertext: string;
          crypto_version?: number;
          key_id: string;
          nonce: string;
          revision?: number;
          schema_version?: number;
          subject_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          capsule_id?: string;
          ciphertext?: string;
          crypto_version?: number;
          key_id?: string;
          nonce?: string;
          revision?: number;
          schema_version?: number;
          subject_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "encrypted_friend_availability_context_fkey";
            columns: ["user_id", "subject_id", "key_id"];
            isOneToOne: false;
            referencedRelation: "crypto_key_envelopes";
            referencedColumns: ["user_id", "subject_id", "friend_availability_key_id"];
          },
        ];
      };
      encrypted_private_data: {
        Row: {
          ciphertext: string;
          crypto_version: number;
          key_id: string;
          nonce: string;
          record_id: string;
          revision: number;
          schema_version: number;
          subject_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ciphertext: string;
          crypto_version?: number;
          key_id: string;
          nonce: string;
          record_id?: string;
          revision?: number;
          schema_version?: number;
          subject_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ciphertext?: string;
          crypto_version?: number;
          key_id?: string;
          nonce?: string;
          record_id?: string;
          revision?: number;
          schema_version?: number;
          subject_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "encrypted_private_data_context_fkey";
            columns: ["user_id", "subject_id", "key_id"];
            isOneToOne: false;
            referencedRelation: "crypto_key_envelopes";
            referencedColumns: ["user_id", "subject_id", "private_data_key_id"];
          },
        ];
      };
      friend_invites: {
        Row: {
          created_at: string;
          expires_at: string;
          owner_id: string;
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          owner_id: string;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          owner_id?: string;
          token_hash?: string;
        };
        Relationships: [];
      };
      friend_profiles: {
        Row: {
          created_at: string;
          display_name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          id: string;
          recipient_accepted_at: string | null;
          requested_by: string;
          requester_accepted_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
          status: string;
          updated_at: string;
          user_a_id: string;
          user_b_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          id?: string;
          recipient_accepted_at?: string | null;
          requested_by: string;
          requester_accepted_at?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          status?: string;
          updated_at?: string;
          user_a_id: string;
          user_b_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          id?: string;
          recipient_accepted_at?: string | null;
          requested_by?: string;
          requester_accepted_at?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          status?: string;
          updated_at?: string;
          user_a_id?: string;
          user_b_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_friend_invite: { Args: { p_invite_code: string }; Returns: boolean };
      create_friend_invite: {
        Args: never;
        Returns: {
          expires_at: string;
          invite_code: string;
        }[];
      };
      disable_friend_invite: { Args: never; Returns: boolean };
      get_friend_capsule_material: {
        Args: { p_friendship_id: string; p_term: string };
        Returns: {
          capsule_ciphertext: string;
          capsule_id: string;
          capsule_nonce: string;
          capsule_revision: number;
          capsule_schema_version: number;
          crypto_version: number;
          kek_version: number;
          key_id: string;
          key_version: number;
          participant: string;
          subject_id: string;
          wrap_nonce: string;
          wrapped_dek: string;
        }[];
      };
      list_friend_connections: {
        Args: never;
        Returns: {
          direction: string;
          friend_display_name: string;
          friendship_id: string;
          status: string;
          updated_at: string;
        }[];
      };
      respond_to_friend_request: {
        Args: { p_accept: boolean; p_friendship_id: string };
        Returns: boolean;
      };
      revoke_friendship: { Args: { p_friendship_id: string }; Returns: boolean };
      rotate_own_key_envelope: {
        Args: {
          p_expected_kek_version: number;
          p_friend_availability_wrap_nonce: string;
          p_friend_availability_wrapped_dek: string;
          p_new_kek_version: number;
          p_private_data_wrap_nonce: string;
          p_private_data_wrapped_dek: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
