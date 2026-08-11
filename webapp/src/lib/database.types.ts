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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admins: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assinatura_usos: {
        Row: {
          abacatepay_usage_id: string | null
          action: string
          assinatura_id: string
          criado_em: string
          id: string
          installment_number: number | null
          obra_acesso_id: string | null
          units: number
        }
        Insert: {
          abacatepay_usage_id?: string | null
          action: string
          assinatura_id: string
          criado_em?: string
          id?: string
          installment_number?: number | null
          obra_acesso_id?: string | null
          units: number
        }
        Update: {
          abacatepay_usage_id?: string | null
          action?: string
          assinatura_id?: string
          criado_em?: string
          id?: string
          installment_number?: number | null
          obra_acesso_id?: string | null
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_usos_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinatura_usos_obra_acesso_id_fkey"
            columns: ["obra_acesso_id"]
            isOneToOne: false
            referencedRelation: "obra_acessos"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          abacatepay_customer_id: string | null
          abacatepay_subscription_id: string | null
          atualizado_em: string
          criado_em: string
          id: string
          limite_obras: number
          plano: Database["public"]["Enums"]["plano_tipo"]
          relatorios_enviados_trial: number
          status: Database["public"]["Enums"]["assinatura_status"]
          trial_fim: string | null
          user_id: string
        }
        Insert: {
          abacatepay_customer_id?: string | null
          abacatepay_subscription_id?: string | null
          atualizado_em?: string
          criado_em?: string
          id?: string
          limite_obras?: number
          plano?: Database["public"]["Enums"]["plano_tipo"]
          relatorios_enviados_trial?: number
          status?: Database["public"]["Enums"]["assinatura_status"]
          trial_fim?: string | null
          user_id: string
        }
        Update: {
          abacatepay_customer_id?: string | null
          abacatepay_subscription_id?: string | null
          atualizado_em?: string
          criado_em?: string
          id?: string
          limite_obras?: number
          plano?: Database["public"]["Enums"]["plano_tipo"]
          relatorios_enviados_trial?: number
          status?: Database["public"]["Enums"]["assinatura_status"]
          trial_fim?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          etapa_id: string
          id: string
          nota: string
          relatorio_id: string
        }
        Insert: {
          etapa_id: string
          id?: string
          nota?: string
          relatorio_id: string
        }
        Update: {
          etapa_id?: string
          id?: string
          nota?: string
          relatorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      clima_snapshots: {
        Row: {
          condicao: Database["public"]["Enums"]["clima_condicao"]
          data: string
          fonte: string
          id: string
          obra_id: string
          prob_chuva: number | null
        }
        Insert: {
          condicao: Database["public"]["Enums"]["clima_condicao"]
          data: string
          fonte?: string
          id?: string
          obra_id: string
          prob_chuva?: number | null
        }
        Update: {
          condicao?: Database["public"]["Enums"]["clima_condicao"]
          data?: string
          fonte?: string
          id?: string
          obra_id?: string
          prob_chuva?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clima_snapshots_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      dias_aditivados: {
        Row: {
          descricao: string | null
          dias: number
          id: string
          motivo: Database["public"]["Enums"]["motivo_aditivo"]
          obra_id: string
          relatorio_id: string
        }
        Insert: {
          descricao?: string | null
          dias: number
          id?: string
          motivo: Database["public"]["Enums"]["motivo_aditivo"]
          obra_id: string
          relatorio_id: string
        }
        Update: {
          descricao?: string | null
          dias?: number
          id?: string
          motivo?: Database["public"]["Enums"]["motivo_aditivo"]
          obra_id?: string
          relatorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dias_aditivados_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dias_aditivados_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas: {
        Row: {
          id: string
          nome: string
          obra_id: string
          ordem: number
          pct_atual: number
          peso: number
        }
        Insert: {
          id?: string
          nome: string
          obra_id: string
          ordem: number
          pct_atual?: number
          peso?: number
        }
        Update: {
          id?: string
          nome?: string
          obra_id?: string
          ordem?: number
          pct_atual?: number
          peso?: number
        }
        Relationships: [
          {
            foreignKeyName: "etapas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos: {
        Row: {
          atividade_id: string | null
          etapa_id: string
          id: string
          obra_id: string
          ordem: number
          relatorio_id: string
          storage_path: string
        }
        Insert: {
          atividade_id?: string | null
          etapa_id: string
          id?: string
          obra_id: string
          ordem?: number
          relatorio_id: string
          storage_path: string
        }
        Update: {
          atividade_id?: string | null
          etapa_id?: string
          id?: string
          obra_id?: string
          ordem?: number
          relatorio_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          criado_em: string
          grupo: Database["public"]["Enums"]["lancamento_grupo"]
          id: string
          numero: number | null
          obra_id: string
          relatorio_id: string | null
          rotulo: string
          tipo: Database["public"]["Enums"]["lancamento_tipo"]
          valor_centavos: number
        }
        Insert: {
          criado_em?: string
          grupo: Database["public"]["Enums"]["lancamento_grupo"]
          id?: string
          numero?: number | null
          obra_id: string
          relatorio_id?: string | null
          rotulo: string
          tipo: Database["public"]["Enums"]["lancamento_tipo"]
          valor_centavos: number
        }
        Update: {
          criado_em?: string
          grupo?: Database["public"]["Enums"]["lancamento_grupo"]
          id?: string
          numero?: number | null
          obra_id?: string
          relatorio_id?: string | null
          rotulo?: string
          tipo?: Database["public"]["Enums"]["lancamento_tipo"]
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_acessos: {
        Row: {
          cobrado_extra: boolean
          criado_em: string
          email: string
          id: string
          obra_id: string
          status: Database["public"]["Enums"]["acesso_status"]
          user_id: string | null
        }
        Insert: {
          cobrado_extra?: boolean
          criado_em?: string
          email: string
          id?: string
          obra_id: string
          status?: Database["public"]["Enums"]["acesso_status"]
          user_id?: string | null
        }
        Update: {
          cobrado_extra?: boolean
          criado_em?: string
          email?: string
          id?: string
          obra_id?: string
          status?: Database["public"]["Enums"]["acesso_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_acessos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_acessos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          arquiteto: string | null
          arquivada_em: string | null
          cliente_nome: string
          construtora: string | null
          criado_em: string
          endereco: string
          engenheiro: string | null
          escritorio_arquitetura: string | null
          foto_capa_path: string | null
          id: string
          inicio_contratual: string
          lat: number | null
          lng: number | null
          nome: string
          owner_id: string
          projetista_estruturas: string | null
          projetista_instalacoes: string | null
          sinal_centavos: number
          termino_contratual: string
          valor_contratado_centavos: number
        }
        Insert: {
          arquiteto?: string | null
          arquivada_em?: string | null
          cliente_nome: string
          construtora?: string | null
          criado_em?: string
          endereco: string
          engenheiro?: string | null
          escritorio_arquitetura?: string | null
          foto_capa_path?: string | null
          id?: string
          inicio_contratual: string
          lat?: number | null
          lng?: number | null
          nome: string
          owner_id: string
          projetista_estruturas?: string | null
          projetista_instalacoes?: string | null
          sinal_centavos?: number
          termino_contratual: string
          valor_contratado_centavos: number
        }
        Update: {
          arquiteto?: string | null
          arquivada_em?: string | null
          cliente_nome?: string
          construtora?: string | null
          criado_em?: string
          endereco?: string
          engenheiro?: string | null
          escritorio_arquitetura?: string | null
          foto_capa_path?: string | null
          id?: string
          inicio_contratual?: string
          lat?: number | null
          lng?: number | null
          nome?: string
          owner_id?: string
          projetista_estruturas?: string | null
          projetista_instalacoes?: string | null
          sinal_centavos?: number
          termino_contratual?: string
          valor_contratado_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "obras_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          criado_em: string
          id: string
          nome: string | null
        }
        Insert: {
          criado_em?: string
          id: string
          nome?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      relatorio_etapas: {
        Row: {
          etapa_id: string
          pct: number
          relatorio_id: string
        }
        Insert: {
          etapa_id: string
          pct: number
          relatorio_id: string
        }
        Update: {
          etapa_id?: string
          pct?: number
          relatorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_etapas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_etapas_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios: {
        Row: {
          criado_em: string
          dados_rascunho: Json | null
          enviado_em: string | null
          geral_antes: number | null
          geral_depois: number | null
          id: string
          numero: number
          obra_id: string
          pdf_path: string | null
          snapshot: Json | null
          status: Database["public"]["Enums"]["relatorio_status"]
        }
        Insert: {
          criado_em?: string
          dados_rascunho?: Json | null
          enviado_em?: string | null
          geral_antes?: number | null
          geral_depois?: number | null
          id?: string
          numero: number
          obra_id: string
          pdf_path?: string | null
          snapshot?: Json | null
          status?: Database["public"]["Enums"]["relatorio_status"]
        }
        Update: {
          criado_em?: string
          dados_rascunho?: Json | null
          enviado_em?: string | null
          geral_antes?: number | null
          geral_depois?: number | null
          id?: string
          numero?: number
          obra_id?: string
          pdf_path?: string | null
          snapshot?: Json | null
          status?: Database["public"]["Enums"]["relatorio_status"]
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks_log: {
        Row: {
          erro: string | null
          evento: string
          id: string
          payload: Json
          processado: boolean
          provedor: string
          recebido_em: string
        }
        Insert: {
          erro?: string | null
          evento: string
          id?: string
          payload: Json
          processado?: boolean
          provedor?: string
          recebido_em?: string
        }
        Update: {
          erro?: string | null
          evento?: string
          id?: string
          payload?: Json
          processado?: boolean
          provedor?: string
          recebido_em?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      eh_dono_obra: { Args: { p_obra: string }; Returns: boolean }
      etapas_padrao: {
        Args: never
        Returns: {
          nome: string
          ordem: number
        }[]
      }
      fn_avanco_geral: { Args: { p_obra: string }; Returns: number }
      fn_criar_obra: {
        Args: {
          p_arquiteto?: string
          p_cliente_nome: string
          p_construtora?: string
          p_endereco: string
          p_engenheiro?: string
          p_escritorio_arquitetura?: string
          p_etapas?: Json
          p_foto_capa_path?: string
          p_inicio: string
          p_lat?: number
          p_lng?: number
          p_nome: string
          p_projetista_estruturas?: string
          p_projetista_instalacoes?: string
          p_sinal_centavos?: number
          p_termino: string
          p_valor_centavos: number
        }
        Returns: string
      }
      fn_enviar_relatorio: { Args: { p_relatorio: string }; Returns: Json }
      fn_proximos_rotulos: { Args: { p_obra: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      tem_acesso_obra: { Args: { p_obra: string }; Returns: boolean }
    }
    Enums: {
      acesso_status: "convidado" | "ativo"
      assinatura_status: "trial" | "ativa" | "inadimplente" | "cancelada"
      clima_condicao: "aberto" | "nublado" | "chuvoso"
      lancamento_grupo: "medicoes" | "materiais" | "aditivos"
      lancamento_tipo: "sinal" | "medicao" | "material" | "aditivo" | "estorno"
      motivo_aditivo:
        | "chuvas"
        | "aditivo_escopo"
        | "atraso_materiais"
        | "licencas"
        | "interferencias"
        | "forca_maior"
        | "outro"
      plano_tipo: "trial" | "obra_1" | "obra_3" | "obra_5"
      relatorio_status: "rascunho" | "enviado"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      acesso_status: ["convidado", "ativo"],
      assinatura_status: ["trial", "ativa", "inadimplente", "cancelada"],
      clima_condicao: ["aberto", "nublado", "chuvoso"],
      lancamento_grupo: ["medicoes", "materiais", "aditivos"],
      lancamento_tipo: ["sinal", "medicao", "material", "aditivo", "estorno"],
      motivo_aditivo: [
        "chuvas",
        "aditivo_escopo",
        "atraso_materiais",
        "licencas",
        "interferencias",
        "forca_maior",
        "outro",
      ],
      plano_tipo: ["trial", "obra_1", "obra_3", "obra_5"],
      relatorio_status: ["rascunho", "enviado"],
    },
  },
} as const
