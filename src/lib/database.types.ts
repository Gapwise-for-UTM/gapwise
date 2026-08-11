// Generated from the connected Supabase project. Regenerate after schema migrations.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
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
      user_preferences: {
        Row: {
          avoid_stairs: boolean;
          day_origin: string;
          prefer_indoor: boolean;
          residence_building_code: string | null;
          route_mode: string;
          transition_buffer_minutes: number;
          updated_at: string;
          user_id: string;
          walking_speed_mps: number;
        };
        Insert: {
          avoid_stairs?: boolean;
          day_origin?: string;
          prefer_indoor?: boolean;
          residence_building_code?: string | null;
          route_mode?: string;
          transition_buffer_minutes?: number;
          updated_at?: string;
          user_id: string;
          walking_speed_mps?: number;
        };
        Update: {
          avoid_stairs?: boolean;
          day_origin?: string;
          prefer_indoor?: boolean;
          residence_building_code?: string | null;
          route_mode?: string;
          transition_buffer_minutes?: number;
          updated_at?: string;
          user_id?: string;
          walking_speed_mps?: number;
        };
        Relationships: [];
      };
      user_schedules: {
        Row: {
          meetings: Json;
          schema_version: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          meetings: Json;
          schema_version?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          meetings?: Json;
          schema_version?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_friend_invite: {
        Args: { p_invite_code: string };
        Returns: boolean;
      };
      create_friend_invite: {
        Args: Record<PropertyKey, never>;
        Returns: { expires_at: string; invite_code: string }[];
      };
      disable_friend_invite: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_friend_gap_overlaps: {
        Args: { p_term: string };
        Returns: {
          end_minute: number;
          friend_display_name: string;
          friendship_id: string;
          start_minute: number;
          weekday: string;
        }[];
      };
      list_friend_connections: {
        Args: Record<PropertyKey, never>;
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
      revoke_friendship: {
        Args: { p_friendship_id: string };
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
      Row: infer Row;
    }
    ? Row
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer Row;
      }
      ? Row
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
      Insert: infer Insert;
    }
    ? Insert
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer Insert;
      }
      ? Insert
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
      Update: infer Update;
    }
    ? Update
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer Update;
      }
      ? Update
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
