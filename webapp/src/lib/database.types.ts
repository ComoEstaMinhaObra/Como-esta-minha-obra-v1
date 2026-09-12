export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          obra_id: string | null
          relatorio_id: string
          versao_id: string | null
        }
        Insert: {
          etapa_id: string
          id?: string
          nota?: string
          obra_id?: string | null
          relatorio_id: string
          versao_id?: string | null
        }
        Update: {
          etapa_id?: string
          id?: string
          nota?: string
          obra_id?: string | null
          relatorio_id?: string
          versao_id?: string | null
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
            foreignKeyName: "atividades_etapa_obra_fk"
            columns: ["etapa_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id", "obra_id"]
          },
          {
            foreignKeyName: "atividades_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_relatorio_obra_fk"
            columns: ["relatorio_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id", "obra_id"]
          },
          {
            foreignKeyName: "atividades_versao_obra_fk"
            columns: ["versao_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorio_versoes"
            referencedColumns: ["id", "obra_id"]
          },
        ]
      }
      avanco_ajustes: {
        Row: {
          criado_em: string
          etapa_id: string
          id: string
          obra_id: string
          pct_antes: number
          pct_depois: number
          relatorio_id: string
          versao_id: string
        }
        Insert: {
          criado_em?: string
          etapa_id: string
          id?: string
          obra_id: string
          pct_antes: number
          pct_depois: number
          relatorio_id: string
          versao_id: string
        }
        Update: {
          criado_em?: string
          etapa_id?: string
          id?: string
          obra_id?: string
          pct_antes?: number
          pct_depois?: number
          relatorio_id?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avanco_ajustes_etapa_obra_fk"
            columns: ["etapa_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id", "obra_id"]
          },
          {
            foreignKeyName: "avanco_ajustes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avanco_ajustes_relatorio_obra_fk"
            columns: ["relatorio_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id", "obra_id"]
          },
          {
            foreignKeyName: "avanco_ajustes_versao_obra_fk"
            columns: ["versao_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorio_versoes"
            referencedColumns: ["id", "obra_id"]
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
          versao_id: string | null
        }
        Insert: {
          descricao?: string | null
          dias: number
          id?: string
          motivo: Database["public"]["Enums"]["motivo_aditivo"]
          obra_id: string
          relatorio_id: string
          versao_id?: string | null
        }
        Update: {
          descricao?: string | null
          dias?: number
          id?: string
          motivo?: Database["public"]["Enums"]["motivo_aditivo"]
          obra_id?: string
          relatorio_id?: string
          versao_id?: string | null
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
          {
            foreignKeyName: "dias_aditivados_relatorio_obra_fk"
            columns: ["relatorio_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id", "obra_id"]
          },
          {
            foreignKeyName: "dias_aditivados_versao_obra_fk"
            columns: ["versao_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorio_versoes"
            referencedColumns: ["id", "obra_id"]
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
          estado: Database["public"]["Enums"]["foto_estado"]
          etapa_id: string
          id: string
          obra_id: string
          ordem: number
          relatorio_id: string
          storage_path: string
          versao_id: string | null
        }
        Insert: {
          atividade_id?: string | null
          estado?: Database["public"]["Enums"]["foto_estado"]
          etapa_id: string
          id?: string
          obra_id: string
          ordem?: number
          relatorio_id: string
          storage_path: string
          versao_id?: string | null
        }
        Update: {
          atividade_id?: string | null
          estado?: Database["public"]["Enums"]["foto_estado"]
          etapa_id?: string
          id?: string
          obra_id?: string
          ordem?: number
          relatorio_id?: string
          storage_path?: string
          versao_id?: string | null
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
            foreignKeyName: "fotos_atividade_obra_fk"
            columns: ["atividade_id", "obra_id", "relatorio_id", "etapa_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id", "obra_id", "relatorio_id", "etapa_id"]
          },
          {
            foreignKeyName: "fotos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_etapa_obra_fk"
            columns: ["etapa_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id", "obra_id"]
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
          {
            foreignKeyName: "fotos_relatorio_obra_fk"
            columns: ["relatorio_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id", "obra_id"]
          },
          {
            foreignKeyName: "fotos_versao_obra_fk"
            columns: ["versao_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorio_versoes"
            referencedColumns: ["id", "obra_id"]
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
          versao_id: string | null
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
          versao_id?: string | null
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
          versao_id?: string | null
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
          {
            foreignKeyName: "lancamentos_relatorio_obra_fk"
            columns: ["relatorio_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id", "obra_id"]
          },
          {
            foreignKeyName: "lancamentos_versao_obra_fk"
            columns: ["versao_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorio_versoes"
            referencedColumns: ["id", "obra_id"]
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
          owner_id: string | null
          revogado_em: string | null
          revogado_por: string | null
          status: Database["public"]["Enums"]["acesso_status"]
          user_id: string | null
        }
        Insert: {
          cobrado_extra?: boolean
          criado_em?: string
          email: string
          id?: string
          obra_id: string
          owner_id?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          status?: Database["public"]["Enums"]["acesso_status"]
          user_id?: string | null
        }
        Update: {
          cobrado_extra?: boolean
          criado_em?: string
          email?: string
          id?: string
          obra_id?: string
          owner_id?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
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
            foreignKeyName: "obra_acessos_obra_owner_fk"
            columns: ["obra_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "obra_acessos_revogado_por_fkey"
            columns: ["revogado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          obra_id: string | null
          pct: number
          relatorio_id: string
          versao_id: string
        }
        Insert: {
          etapa_id: string
          obra_id?: string | null
          pct: number
          relatorio_id: string
          versao_id: string
        }
        Update: {
          etapa_id?: string
          obra_id?: string | null
          pct?: number
          relatorio_id?: string
          versao_id?: string
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
            foreignKeyName: "relatorio_etapas_etapa_obra_fk"
            columns: ["etapa_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id", "obra_id"]
          },
          {
            foreignKeyName: "relatorio_etapas_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_etapas_relatorio_obra_fk"
            columns: ["relatorio_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id", "obra_id"]
          },
          {
            foreignKeyName: "relatorio_etapas_versao_obra_fk"
            columns: ["versao_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorio_versoes"
            referencedColumns: ["id", "obra_id"]
          },
        ]
      }
      relatorio_versoes: {
        Row: {
          criado_em: string
          criado_por: string
          dados_aplicacao: Json | null
          id: string
          motivo: string | null
          numero: number
          obra_id: string
          pdf_path: string | null
          pdf_sha256: string | null
          publicado_em: string | null
          relatorio_id: string
          snapshot: Json
          status: Database["public"]["Enums"]["versao_status"]
          tipo: Database["public"]["Enums"]["versao_tipo"]
        }
        Insert: {
          criado_em?: string
          criado_por: string
          dados_aplicacao?: Json | null
          id?: string
          motivo?: string | null
          numero: number
          obra_id: string
          pdf_path?: string | null
          pdf_sha256?: string | null
          publicado_em?: string | null
          relatorio_id: string
          snapshot: Json
          status: Database["public"]["Enums"]["versao_status"]
          tipo: Database["public"]["Enums"]["versao_tipo"]
        }
        Update: {
          criado_em?: string
          criado_por?: string
          dados_aplicacao?: Json | null
          id?: string
          motivo?: string | null
          numero?: number
          obra_id?: string
          pdf_path?: string | null
          pdf_sha256?: string | null
          publicado_em?: string | null
          relatorio_id?: string
          snapshot?: Json
          status?: Database["public"]["Enums"]["versao_status"]
          tipo?: Database["public"]["Enums"]["versao_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_versoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_versoes_relatorio_obra_fk"
            columns: ["relatorio_id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id", "obra_id"]
          },
        ]
      }
      relatorios: {
        Row: {
          criado_em: string
          dados_rascunho: Json | null
          enviado_em: string | null
          erro_operacional: string | null
          geral_antes: number | null
          geral_depois: number | null
          id: string
          numero: number
          obra_id: string
          pdf_path: string | null
          snapshot: Json | null
          status: Database["public"]["Enums"]["relatorio_status"]
          versao_atual_id: string | null
          versao_pendente_id: string | null
        }
        Insert: {
          criado_em?: string
          dados_rascunho?: Json | null
          enviado_em?: string | null
          erro_operacional?: string | null
          geral_antes?: number | null
          geral_depois?: number | null
          id?: string
          numero: number
          obra_id: string
          pdf_path?: string | null
          snapshot?: Json | null
          status?: Database["public"]["Enums"]["relatorio_status"]
          versao_atual_id?: string | null
          versao_pendente_id?: string | null
        }
        Update: {
          criado_em?: string
          dados_rascunho?: Json | null
          enviado_em?: string | null
          erro_operacional?: string | null
          geral_antes?: number | null
          geral_depois?: number | null
          id?: string
          numero?: number
          obra_id?: string
          pdf_path?: string | null
          snapshot?: Json | null
          status?: Database["public"]["Enums"]["relatorio_status"]
          versao_atual_id?: string | null
          versao_pendente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_versao_atual_fk"
            columns: ["versao_atual_id", "id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorio_versoes"
            referencedColumns: ["id", "relatorio_id", "obra_id"]
          },
          {
            foreignKeyName: "relatorios_versao_pendente_fk"
            columns: ["versao_pendente_id", "id", "obra_id"]
            isOneToOne: false
            referencedRelation: "relatorio_versoes"
            referencedColumns: ["id", "relatorio_id", "obra_id"]
          },
        ]
      }
      webhooks_log: {
        Row: {
          claim_em: string | null
          erro: string | null
          event_id: string
          evento: string
          id: string
          payload: Json
          processado: boolean
          processado_em: string | null
          provedor: string
          recebido_em: string
          tentativas: number
        }
        Insert: {
          claim_em?: string | null
          erro?: string | null
          event_id: string
          evento: string
          id?: string
          payload: Json
          processado?: boolean
          processado_em?: string | null
          provedor?: string
          recebido_em?: string
          tentativas?: number
        }
        Update: {
          claim_em?: string | null
          erro?: string | null
          event_id?: string
          evento?: string
          id?: string
          payload?: Json
          processado?: boolean
          processado_em?: string | null
          provedor?: string
          recebido_em?: string
          tentativas?: number
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
      fn_admin_contas: { Args: never; Returns: Json }
      fn_admin_kpis: { Args: never; Returns: Json }
      fn_admin_obras: { Args: { p_owner?: string }; Returns: Json }
      fn_admin_reprocessar_webhook: { Args: { p_log: string }; Returns: Json }
      fn_admin_webhooks: { Args: never; Returns: Json }
      fn_arquivar_obra: {
        Args: { p_nome: string; p_obra: string }
        Returns: Json
      }
      fn_atualizar_capa_obra: {
        Args: { p_obra: string; p_path: string }
        Returns: undefined
      }
      fn_avanco_geral: { Args: { p_obra: string }; Returns: number }
      fn_claim_outbox: { Args: { p_outbox: string }; Returns: Json }
      fn_claim_webhook_evento: {
        Args: {
          p_event_id: string
          p_evento: string
          p_force?: boolean
          p_payload: Json
        }
        Returns: Json
      }
      fn_confirmar_outbox: {
        Args: { p_installment: number; p_outbox: string; p_usage_id: string }
        Returns: Json
      }
      fn_consumir_rate_limit: { Args: { p_acao: string }; Returns: undefined }
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
      fn_enfileirar_renovacao_emails: {
        Args: { p_assinatura: string; p_event_id: string; p_parcela: number }
        Returns: Json
      }
      fn_enviar_relatorio: { Args: { p_relatorio: string }; Returns: Json }
      fn_dados_versao_atual: {
        Args: { p_relatorio: string }
        Returns: Json
      }
      fn_falhar_outbox: {
        Args: { p_erro: string; p_incerto: boolean; p_outbox: string }
        Returns: undefined
      }
      fn_finalizar_envio_relatorio: {
        Args: { p_pdf_path: string; p_pdf_sha256: string; p_versao: string }
        Returns: Json
      }
      fn_finalizar_retificacao: {
        Args: { p_pdf_path: string; p_pdf_sha256: string; p_versao: string }
        Returns: Json
      }
      fn_listar_obras_empreiteiro: { Args: never; Returns: Json }
      fn_listar_outbox_pendente: { Args: never; Returns: Json }
      fn_marcar_versao_falhou: {
        Args: { p_erro: string; p_versao: string }
        Returns: undefined
      }
      fn_preparar_envio_relatorio: {
        Args: { p_relatorio: string }
        Returns: Json
      }
      fn_preparar_retificacao: {
        Args: { p_dados: Json; p_motivo: string; p_relatorio: string }
        Returns: Json
      }
      fn_proximos_rotulos: { Args: { p_obra: string }; Returns: Json }
      fn_purgar_rate_limits: { Args: never; Returns: number }
      fn_purgar_webhooks: { Args: never; Returns: number }
      fn_remover_foto_rascunho: {
        Args: { p_storage_path: string }
        Returns: undefined
      }
      fn_reservar_foto: {
        Args: { p_etapa: string; p_obra: string; p_relatorio: string }
        Returns: Json
      }
      fn_revogar_acesso_obra: {
        Args: { p_acesso: string; p_obra: string }
        Returns: Json
      }
      fn_salvar_rascunho: {
        Args: { p_dados: Json; p_obra: string; p_relatorio: string }
        Returns: Json
      }
      fn_solicitar_acesso_obra: {
        Args: { p_email: string; p_obra: string }
        Returns: Json
      }
      fn_reagendar_outbox: {
        Args: { p_erro: string; p_outbox: string }
        Returns: undefined
      }
      fn_registrar_customer_id: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      fn_sou_admin: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      tem_acesso_obra: { Args: { p_obra: string }; Returns: boolean }
    }
    Enums: {
      acesso_status: "convidado" | "ativo" | "pendente_cobranca" | "revogado"
      assinatura_status: "trial" | "ativa" | "inadimplente" | "cancelada"
      clima_condicao: "aberto" | "nublado" | "chuvoso"
      foto_estado: "reservada" | "publicada"
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
      outbox_operacao: "add" | "subtract"
      outbox_status:
        | "pendente"
        | "processando"
        | "confirmado"
        | "falhou"
        | "incerto"
        | "cancelado"
      plano_tipo: "trial" | "obra_1" | "obra_3" | "obra_5"
      relatorio_status: "rascunho" | "enviado" | "processando"
      versao_status: "processando" | "publicada" | "falhou"
      versao_tipo: "original" | "retificacao"
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
      acesso_status: ["convidado", "ativo", "pendente_cobranca", "revogado"],
      assinatura_status: ["trial", "ativa", "inadimplente", "cancelada"],
      clima_condicao: ["aberto", "nublado", "chuvoso"],
      foto_estado: ["reservada", "publicada"],
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
      outbox_operacao: ["add", "subtract"],
      outbox_status: [
        "pendente",
        "processando",
        "confirmado",
        "falhou",
        "incerto",
      ],
      plano_tipo: ["trial", "obra_1", "obra_3", "obra_5"],
      relatorio_status: ["rascunho", "enviado", "processando"],
      versao_status: ["processando", "publicada", "falhou"],
      versao_tipo: ["original", "retificacao"],
    },
  },
} as const
