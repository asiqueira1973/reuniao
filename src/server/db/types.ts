// Gerado por `npm run db:types` (supabase gen types). Não editar à mão.
import "server-only";


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ag_conexoes_google": {
                  Row: {
                    "atualizado_em": string,"aviso_reconectar_enviado": boolean,"conta_id": string,"escopos": (string)[],"refresh_token_cifrado": string,"revogada_em": string | null,"status": Database["public"]['Enums']["ag_status_conexao"]
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"aviso_reconectar_enviado"?: boolean,"conta_id": string,"escopos": (string)[],"refresh_token_cifrado": string,"revogada_em"?: string | null,"status"?: Database["public"]['Enums']["ag_status_conexao"]
                  }
                  Update: {
                    "atualizado_em"?: string,"aviso_reconectar_enviado"?: boolean,"conta_id"?: string,"escopos"?: (string)[],"refresh_token_cifrado"?: string,"revogada_em"?: string | null,"status"?: Database["public"]['Enums']["ag_status_conexao"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ag_conexoes_google_conta_id_fkey"
      columns: ["conta_id"]
isOneToOne: true
      referencedRelation: "ag_contas"
      referencedColumns: ["id"]
    }
                  ]
                },"ag_contas": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"email": string,"feriados_ativos": boolean,"feriados_desligados": (string)[],"fuso": string,"google_sub": string,"id": string,"mensagem_boas_vindas": string | null,"nome_exibicao": string,"slug": string,"suspensa_em": string | null,"termos_aceitos_em": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"email": string,"feriados_ativos"?: boolean,"feriados_desligados"?: (string)[],"fuso"?: string,"google_sub": string,"id"?: string,"mensagem_boas_vindas"?: string | null,"nome_exibicao": string,"slug": string,"suspensa_em"?: string | null,"termos_aceitos_em"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"email"?: string,"feriados_ativos"?: boolean,"feriados_desligados"?: (string)[],"fuso"?: string,"google_sub"?: string,"id"?: string,"mensagem_boas_vindas"?: string | null,"nome_exibicao"?: string,"slug"?: string,"suspensa_em"?: string | null,"termos_aceitos_em"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ag_excecoes_data": {
                  Row: {
                    "conta_id": string,"data": string,"fim": string | null,"id": string,"inicio": string | null,"tipo": Database["public"]['Enums']["ag_tipo_excecao"]
                  }
                  ComputedFields: never
                  Insert: {
                    "conta_id": string,"data": string,"fim"?: string | null,"id"?: string,"inicio"?: string | null,"tipo": Database["public"]['Enums']["ag_tipo_excecao"]
                  }
                  Update: {
                    "conta_id"?: string,"data"?: string,"fim"?: string | null,"id"?: string,"inicio"?: string | null,"tipo"?: Database["public"]['Enums']["ag_tipo_excecao"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ag_excecoes_data_conta_id_fkey"
      columns: ["conta_id"]
isOneToOne: false
      referencedRelation: "ag_contas"
      referencedColumns: ["id"]
    }
                  ]
                },"ag_horarios_semanais": {
                  Row: {
                    "conta_id": string,"dia_semana": number,"fim": string,"id": string,"inicio": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conta_id": string,"dia_semana": number,"fim": string,"id"?: string,"inicio": string
                  }
                  Update: {
                    "conta_id"?: string,"dia_semana"?: number,"fim"?: string,"id"?: string,"inicio"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ag_horarios_semanais_conta_id_fkey"
      columns: ["conta_id"]
isOneToOne: false
      referencedRelation: "ag_contas"
      referencedColumns: ["id"]
    }
                  ]
                },"ag_notificacoes": {
                  Row: {
                    "conta_id": string,"criado_em": string,"enviada_em": string | null,"erro": string | null,"id": string,"resend_id": string | null,"reserva_id": string | null,"status": Database["public"]['Enums']["ag_status_notificacao"],"tentativas": number,"tipo": Database["public"]['Enums']["ag_tipo_notificacao"]
                  }
                  ComputedFields: never
                  Insert: {
                    "conta_id": string,"criado_em"?: string,"enviada_em"?: string | null,"erro"?: string | null,"id"?: string,"resend_id"?: string | null,"reserva_id"?: string | null,"status"?: Database["public"]['Enums']["ag_status_notificacao"],"tentativas"?: number,"tipo": Database["public"]['Enums']["ag_tipo_notificacao"]
                  }
                  Update: {
                    "conta_id"?: string,"criado_em"?: string,"enviada_em"?: string | null,"erro"?: string | null,"id"?: string,"resend_id"?: string | null,"reserva_id"?: string | null,"status"?: Database["public"]['Enums']["ag_status_notificacao"],"tentativas"?: number,"tipo"?: Database["public"]['Enums']["ag_tipo_notificacao"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ag_notificacoes_conta_id_fkey"
      columns: ["conta_id"]
isOneToOne: false
      referencedRelation: "ag_contas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ag_notificacoes_reserva_id_fkey"
      columns: ["reserva_id"]
isOneToOne: false
      referencedRelation: "ag_reservas"
      referencedColumns: ["id"]
    }
                  ]
                },"ag_reservas": {
                  Row: {
                    "atualizado_em": string,"cancelada_em": string | null,"conta_id": string,"criado_em": string,"dados_anonimizados_em": string | null,"email_convidado": string,"fim": string,"fuso_convidado": string,"google_evento_id": string | null,"id": string,"inicio": string,"link_meet": string | null,"motivo_cancelamento": string | null,"nome_convidado": string,"observacao": string | null,"remarcada_de_id": string | null,"status": Database["public"]['Enums']["ag_status_reserva"],"tipo_evento_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"cancelada_em"?: string | null,"conta_id": string,"criado_em"?: string,"dados_anonimizados_em"?: string | null,"email_convidado": string,"fim": string,"fuso_convidado": string,"google_evento_id"?: string | null,"id"?: string,"inicio": string,"link_meet"?: string | null,"motivo_cancelamento"?: string | null,"nome_convidado": string,"observacao"?: string | null,"remarcada_de_id"?: string | null,"status"?: Database["public"]['Enums']["ag_status_reserva"],"tipo_evento_id": string,"token_hash": string
                  }
                  Update: {
                    "atualizado_em"?: string,"cancelada_em"?: string | null,"conta_id"?: string,"criado_em"?: string,"dados_anonimizados_em"?: string | null,"email_convidado"?: string,"fim"?: string,"fuso_convidado"?: string,"google_evento_id"?: string | null,"id"?: string,"inicio"?: string,"link_meet"?: string | null,"motivo_cancelamento"?: string | null,"nome_convidado"?: string,"observacao"?: string | null,"remarcada_de_id"?: string | null,"status"?: Database["public"]['Enums']["ag_status_reserva"],"tipo_evento_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ag_reservas_conta_id_fkey"
      columns: ["conta_id"]
isOneToOne: false
      referencedRelation: "ag_contas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ag_reservas_remarcada_de_id_fkey"
      columns: ["remarcada_de_id"]
isOneToOne: false
      referencedRelation: "ag_reservas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ag_reservas_tipo_evento_id_fkey"
      columns: ["tipo_evento_id"]
isOneToOne: false
      referencedRelation: "ag_tipos_evento"
      referencedColumns: ["id"]
    }
                  ]
                },"ag_tipos_evento": {
                  Row: {
                    "antecedencia_min": number,"ativo": boolean,"atualizado_em": string,"com_meet": boolean,"conta_id": string,"criado_em": string,"descricao": string | null,"duracao_min": number,"excluido_em": string | null,"id": string,"intervalo_antes_min": number,"intervalo_depois_min": number,"janela_dias": number,"nome": string,"ordem": number,"passo_min": number,"slug": string,"visivel_na_pagina": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "antecedencia_min"?: number,"ativo"?: boolean,"atualizado_em"?: string,"com_meet"?: boolean,"conta_id": string,"criado_em"?: string,"descricao"?: string | null,"duracao_min"?: number,"excluido_em"?: string | null,"id"?: string,"intervalo_antes_min"?: number,"intervalo_depois_min"?: number,"janela_dias"?: number,"nome": string,"ordem"?: number,"passo_min"?: number,"slug": string,"visivel_na_pagina"?: boolean
                  }
                  Update: {
                    "antecedencia_min"?: number,"ativo"?: boolean,"atualizado_em"?: string,"com_meet"?: boolean,"conta_id"?: string,"criado_em"?: string,"descricao"?: string | null,"duracao_min"?: number,"excluido_em"?: string | null,"id"?: string,"intervalo_antes_min"?: number,"intervalo_depois_min"?: number,"janela_dias"?: number,"nome"?: string,"ordem"?: number,"passo_min"?: number,"slug"?: string,"visivel_na_pagina"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "ag_tipos_evento_conta_id_fkey"
      columns: ["conta_id"]
isOneToOne: false
      referencedRelation: "ag_contas"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "ag_fn_desfaz_remarcacao":
{ Args: { "p_nova_id": string }; Returns: string
                           },
"ag_fn_remarcar_reservar":
{ Args: { "p_antiga_id": string,"p_fim": string,"p_fuso": string,"p_inicio": string,"p_token_hash": string }; Returns: string
                           },
"ag_fn_substitui_excecoes_data":
{ Args: { "p_conta_id": string,"p_data": string,"p_faixas": Json,"p_tipo": Database["public"]['Enums']["ag_tipo_excecao"] }; Returns: undefined
                           },
"ag_fn_substitui_horarios":
{ Args: { "p_conta_id": string,"p_faixas": Json }; Returns: undefined
                           }
          }
          Enums: {
            "ag_status_conexao": "ativa"|"revogada","ag_status_notificacao": "pendente"|"enviada"|"falhou","ag_status_reserva": "processando"|"confirmada"|"cancelada_convidado"|"cancelada_dono"|"remarcada"|"falhou","ag_tipo_excecao": "indisponivel"|"horario_especial","ag_tipo_notificacao": "confirmacao_convidado"|"aviso_dono_nova"|"aviso_dono_remarcada"|"aviso_dono_cancelada"|"cancelamento_convidado"|"reconectar_google"
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
            "ag_status_conexao": ["ativa", "revogada"],"ag_status_notificacao": ["pendente", "enviada", "falhou"],"ag_status_reserva": ["processando", "confirmada", "cancelada_convidado", "cancelada_dono", "remarcada", "falhou"],"ag_tipo_excecao": ["indisponivel", "horario_especial"],"ag_tipo_notificacao": ["confirmacao_convidado", "aviso_dono_nova", "aviso_dono_remarcada", "aviso_dono_cancelada", "cancelamento_convidado", "reconectar_google"]
          }
        }
} as const
