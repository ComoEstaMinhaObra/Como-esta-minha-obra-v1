export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string | null;
          criado_em: string;
        };
        Insert: {
          id: string;
          nome?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string | null;
          criado_em?: string;
        };
        Relationships: [];
      };
      assinaturas: {
        Row: {
          id: string;
          user_id: string;
          status: Database["public"]["Enums"]["assinatura_status"];
          plano: Database["public"]["Enums"]["plano_tipo"];
          limite_obras: number;
          trial_fim: string | null;
          relatorios_enviados_trial: number;
          abacatepay_customer_id: string | null;
          abacatepay_subscription_id: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: Database["public"]["Enums"]["assinatura_status"];
          plano?: Database["public"]["Enums"]["plano_tipo"];
          limite_obras?: number;
          trial_fim?: string | null;
          relatorios_enviados_trial?: number;
          abacatepay_customer_id?: string | null;
          abacatepay_subscription_id?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: Database["public"]["Enums"]["assinatura_status"];
          plano?: Database["public"]["Enums"]["plano_tipo"];
          limite_obras?: number;
          trial_fim?: string | null;
          relatorios_enviados_trial?: number;
          abacatepay_customer_id?: string | null;
          abacatepay_subscription_id?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [];
      };
      obras: {
        Row: {
          id: string;
          owner_id: string;
          nome: string;
          endereco: string;
          lat: number | null;
          lng: number | null;
          cliente_nome: string;
          construtora: string | null;
          engenheiro: string | null;
          escritorio_arquitetura: string | null;
          arquiteto: string | null;
          projetista_estruturas: string | null;
          projetista_instalacoes: string | null;
          foto_capa_path: string | null;
          inicio_contratual: string;
          termino_contratual: string;
          valor_contratado_centavos: number;
          sinal_centavos: number;
          arquivada_em: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          nome: string;
          endereco: string;
          lat?: number | null;
          lng?: number | null;
          cliente_nome: string;
          construtora?: string | null;
          engenheiro?: string | null;
          escritorio_arquitetura?: string | null;
          arquiteto?: string | null;
          projetista_estruturas?: string | null;
          projetista_instalacoes?: string | null;
          foto_capa_path?: string | null;
          inicio_contratual: string;
          termino_contratual: string;
          valor_contratado_centavos: number;
          sinal_centavos?: number;
          arquivada_em?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["obras"]["Insert"]>;
        Relationships: [];
      };
      etapas: {
        Row: {
          id: string;
          obra_id: string;
          nome: string;
          ordem: number;
          peso: number;
          pct_atual: number;
        };
        Insert: {
          id?: string;
          obra_id: string;
          nome: string;
          ordem: number;
          peso?: number;
          pct_atual?: number;
        };
        Update: Partial<Database["public"]["Tables"]["etapas"]["Insert"]>;
        Relationships: [];
      };
      obra_acessos: {
        Row: {
          id: string;
          obra_id: string;
          email: string;
          user_id: string | null;
          status: Database["public"]["Enums"]["acesso_status"];
          cobrado_extra: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          email: string;
          user_id?: string | null;
          status?: Database["public"]["Enums"]["acesso_status"];
          cobrado_extra?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["obra_acessos"]["Insert"]>;
        Relationships: [];
      };
      relatorios: {
        Row: {
          id: string;
          obra_id: string;
          numero: number;
          status: Database["public"]["Enums"]["relatorio_status"];
          dados_rascunho: Json | null;
          snapshot: Json | null;
          pdf_path: string | null;
          geral_antes: number | null;
          geral_depois: number | null;
          criado_em: string;
          enviado_em: string | null;
        };
        Insert: {
          id?: string;
          obra_id: string;
          numero: number;
          status?: Database["public"]["Enums"]["relatorio_status"];
          dados_rascunho?: Json | null;
          snapshot?: Json | null;
          pdf_path?: string | null;
          geral_antes?: number | null;
          geral_depois?: number | null;
          criado_em?: string;
          enviado_em?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["relatorios"]["Insert"]>;
        Relationships: [];
      };
      relatorio_etapas: {
        Row: {
          relatorio_id: string;
          etapa_id: string;
          pct: number;
        };
        Insert: {
          relatorio_id: string;
          etapa_id: string;
          pct: number;
        };
        Update: Partial<Database["public"]["Tables"]["relatorio_etapas"]["Insert"]>;
        Relationships: [];
      };
      lancamentos: {
        Row: {
          id: string;
          obra_id: string;
          relatorio_id: string | null;
          tipo: Database["public"]["Enums"]["lancamento_tipo"];
          grupo: Database["public"]["Enums"]["lancamento_grupo"];
          numero: number | null;
          rotulo: string;
          valor_centavos: number;
          criado_em: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          relatorio_id?: string | null;
          tipo: Database["public"]["Enums"]["lancamento_tipo"];
          grupo: Database["public"]["Enums"]["lancamento_grupo"];
          numero?: number | null;
          rotulo: string;
          valor_centavos: number;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lancamentos"]["Insert"]>;
        Relationships: [];
      };
      atividades: {
        Row: {
          id: string;
          relatorio_id: string;
          etapa_id: string;
          nota: string;
        };
        Insert: {
          id?: string;
          relatorio_id: string;
          etapa_id: string;
          nota?: string;
        };
        Update: Partial<Database["public"]["Tables"]["atividades"]["Insert"]>;
        Relationships: [];
      };
      fotos: {
        Row: {
          id: string;
          obra_id: string;
          relatorio_id: string;
          etapa_id: string;
          atividade_id: string | null;
          storage_path: string;
          ordem: number;
        };
        Insert: {
          id?: string;
          obra_id: string;
          relatorio_id: string;
          etapa_id: string;
          atividade_id?: string | null;
          storage_path: string;
          ordem?: number;
        };
        Update: Partial<Database["public"]["Tables"]["fotos"]["Insert"]>;
        Relationships: [];
      };
      dias_aditivados: {
        Row: {
          id: string;
          obra_id: string;
          relatorio_id: string;
          motivo: Database["public"]["Enums"]["motivo_aditivo"];
          descricao: string | null;
          dias: number;
        };
        Insert: {
          id?: string;
          obra_id: string;
          relatorio_id: string;
          motivo: Database["public"]["Enums"]["motivo_aditivo"];
          descricao?: string | null;
          dias: number;
        };
        Update: Partial<Database["public"]["Tables"]["dias_aditivados"]["Insert"]>;
        Relationships: [];
      };
      clima_snapshots: {
        Row: {
          id: string;
          obra_id: string;
          data: string;
          condicao: Database["public"]["Enums"]["clima_condicao"];
          prob_chuva: number | null;
          fonte: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          data: string;
          condicao: Database["public"]["Enums"]["clima_condicao"];
          prob_chuva?: number | null;
          fonte?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clima_snapshots"]["Insert"]>;
        Relationships: [];
      };
      assinatura_usos: {
        Row: {
          id: string;
          assinatura_id: string;
          obra_acesso_id: string | null;
          action: string;
          units: number;
          abacatepay_usage_id: string | null;
          installment_number: number | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          assinatura_id: string;
          obra_acesso_id?: string | null;
          action: string;
          units: number;
          abacatepay_usage_id?: string | null;
          installment_number?: number | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["assinatura_usos"]["Insert"]>;
        Relationships: [];
      };
      webhooks_log: {
        Row: {
          id: string;
          provedor: string;
          evento: string;
          payload: Json;
          processado: boolean;
          erro: string | null;
          recebido_em: string;
        };
        Insert: {
          id?: string;
          provedor?: string;
          evento: string;
          payload: Json;
          processado?: boolean;
          erro?: string | null;
          recebido_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["webhooks_log"]["Insert"]>;
        Relationships: [];
      };
      admins: {
        Row: { user_id: string };
        Insert: { user_id: string };
        Update: { user_id?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      fn_avanco_geral: { Args: { p_obra: string }; Returns: number };
      fn_proximos_rotulos: { Args: { p_obra: string }; Returns: Json };
      fn_criar_obra: {
        Args: {
          p_nome: string;
          p_endereco: string;
          p_cliente_nome: string;
          p_inicio: string;
          p_termino: string;
          p_valor_centavos: number;
          p_sinal_centavos?: number;
          p_lat?: number;
          p_lng?: number;
          p_construtora?: string;
          p_engenheiro?: string;
          p_escritorio_arquitetura?: string;
          p_arquiteto?: string;
          p_projetista_estruturas?: string;
          p_projetista_instalacoes?: string;
          p_foto_capa_path?: string;
          p_etapas?: Json;
        };
        Returns: string;
      };
      fn_enviar_relatorio: { Args: { p_relatorio: string }; Returns: Json };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      plano_tipo: "trial" | "obra_1" | "obra_3" | "obra_5";
      assinatura_status: "trial" | "ativa" | "inadimplente" | "cancelada";
      relatorio_status: "rascunho" | "enviado";
      lancamento_tipo: "sinal" | "medicao" | "material" | "aditivo" | "estorno";
      lancamento_grupo: "medicoes" | "materiais" | "aditivos";
      acesso_status: "convidado" | "ativo";
      motivo_aditivo:
        | "chuvas"
        | "aditivo_escopo"
        | "atraso_materiais"
        | "licencas"
        | "interferencias"
        | "forca_maior"
        | "outro";
      clima_condicao: "aberto" | "nublado" | "chuvoso";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
