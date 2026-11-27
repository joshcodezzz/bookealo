export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "customer" | "business_owner" | "super_admin";

export type BookingStatus = "pending" | "confirmed" | "blocked" | "cancelled";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
};

export type BusinessRow = {
  id: string;
  name: string;
  zone: string | null;
  maps_url: string | null;
  phone: string | null;
  cover_image_url: string | null;
  amenities: Json;
  /** Ver CATEGORY_ORDER en src/lib/categories.ts; null = se deduce por el nombre */
  category?: string | null;
  /** "gratis" | "pro". Ver src/lib/plans.ts */
  plan?: string;
  cancellation_policy: string | null;
  /** Texto de presentación del negocio, revisado por el administrador */
  description?: string | null;
  is_active: boolean;
  created_at: string;
  owner_id: string | null;
};

export type ApplicationStatus = "pending" | "approved" | "rejected";
export type ApplicationPhoto = { path: string; url: string };

/** Solicitud de un negocio para aparecer en Bookealo; la revisa el administrador a mano. */
export type BusinessApplicationRow = {
  id: string;
  applicant_id: string;
  status: ApplicationStatus;
  business_name: string;
  category: string;
  zone: string | null;
  phone: string | null;
  maps_url: string | null;
  instagram: string | null;
  description: string;
  services_text: string;
  photos: Json;
  review_note: string | null;
  business_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type ServiceRow = {
  id: string;
  business_id: string;
  name: string;
  price: number;
  slot_duration_minutes: number;
  is_roofed: boolean;
  is_active: boolean;
  created_at: string;
};

export type ScheduleRow = {
  id: string;
  service_id: string;
  day_of_week: number; // 0 = domingo ... 6 = sábado
  open_time: string; // formato HH:MM:SS
  close_time: string; // formato HH:MM:SS
  is_closed: boolean;
};

export type MediaKind = "image" | "video" | "model3d";

export type BusinessMediaRow = {
  id: string;
  business_id: string;
  kind: MediaKind;
  storage_path: string;
  url: string;
  title: string | null;
  position: number;
  created_at: string;
};

export type ReminderKind = "24h" | "2h" | "30m";
export type ReminderStatus = "queued" | "sent" | "failed" | "skipped";

export type BookingReminderRow = {
  id: string;
  booking_id: string;
  kind: ReminderKind;
  due_at: string;
  to_name: string | null;
  to_phone: string | null;
  message: string;
  params: Json;
  status: ReminderStatus;
  error: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
};

export type ConversationRow = {
  id: string;
  business_id: string;
  customer_id: string;
  customer_name: string | null;
  created_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_id: string | null;
  customer_read_at: string | null;
  owner_read_at: string | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type BookingRow = {
  id: string;
  service_id: string;
  customer_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  start_time: string; // timestamptz ISO
  end_time: string; // timestamptz ISO
  status: BookingStatus;
  total_price: number | null;
  notes: string | null;
  created_at: string;
};

export type MyCustomerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

export type BusySlotRow = {
  slot_start: string;
  slot_end: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          full_name?: string | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      businesses: {
        Row: BusinessRow;
        Insert: {
          id?: string;
          name: string;
          zone?: string | null;
          maps_url?: string | null;
          phone?: string | null;
          cover_image_url?: string | null;
          amenities?: Json;
          category?: string | null;
          plan?: string;
          description?: string | null;
          cancellation_policy?: string | null;
          is_active?: boolean;
          created_at?: string;
          owner_id?: string | null;
        };
        Update: {
          name?: string;
          zone?: string | null;
          maps_url?: string | null;
          phone?: string | null;
          cover_image_url?: string | null;
          amenities?: Json;
          category?: string | null;
          plan?: string;
          description?: string | null;
          cancellation_policy?: string | null;
          is_active?: boolean;
          owner_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "businesses_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: ServiceRow;
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          price: number;
          slot_duration_minutes?: number;
          is_roofed?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          price?: number;
          slot_duration_minutes?: number;
          is_roofed?: boolean;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_media: {
        Row: BusinessMediaRow;
        Insert: {
          id?: string;
          business_id: string;
          kind: MediaKind;
          storage_path: string;
          url: string;
          title?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          title?: string | null;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "business_media_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_reminders: {
        Row: BookingReminderRow;
        Insert: {
          booking_id: string;
          kind: ReminderKind;
          due_at: string;
          message: string;
        };
        Update: {
          status?: ReminderStatus;
          error?: string | null;
          attempts?: number;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_reminders_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      business_applications: {
        Row: BusinessApplicationRow;
        Insert: {
          applicant_id: string;
          business_name: string;
          category: string;
          zone?: string | null;
          phone?: string | null;
          maps_url?: string | null;
          instagram?: string | null;
          description: string;
          services_text: string;
          photos?: Json;
        };
        Update: {
          status?: ApplicationStatus;
          review_note?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
      conversations: {
        Row: ConversationRow;
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          customer_name?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: MessageRow;
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      schedules: {
        Row: ScheduleRow;
        Insert: {
          id?: string;
          service_id: string;
          day_of_week: number;
          open_time: string;
          close_time: string;
          is_closed?: boolean;
        };
        Update: {
          day_of_week?: number;
          open_time?: string;
          close_time?: string;
          is_closed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "schedules_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: BookingRow;
        Insert: {
          id?: string;
          service_id: string;
          customer_id?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          start_time: string;
          end_time: string;
          status: BookingStatus;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          // Por reglas de BD/RLS, solo se puede actualizar status en reservas existentes
          status: BookingStatus;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      my_customers: {
        Row: MyCustomerRow;
        Relationships: [];
      };
    };
    Functions: {
      get_busy_slots: {
        Args: {
          p_service_id: string;
          p_from: string;
          p_to: string;
        };
        Returns: BusySlotRow[];
      };
      get_business_booking_counts: {
        Args: {
          p_since: string;
        };
        Returns: { business_id: string; booking_count: number }[];
      };
      mark_conversation_read: {
        Args: {
          p_conversation: string;
        };
        Returns: undefined;
      };
      admin_assign_owner: {
        Args: {
          p_business: string;
          p_email: string;
        };
        Returns: string;
      };
      admin_approve_application: {
        Args: {
          p_application: string;
        };
        Returns: string;
      };
      admin_business_owners: {
        Args: Record<string, never>;
        Returns: { business_id: string; owner_email: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export function parseAmenities(amenities: Json | null | undefined): string[] {
  if (!Array.isArray(amenities)) {
    return [];
  }
  return amenities
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
