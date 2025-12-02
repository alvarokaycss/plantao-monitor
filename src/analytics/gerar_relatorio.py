# flake8: noqa
# type: ignore

import os
import sys
import psycopg2
import pandas as pd
import matplotlib.pyplot as plt
from dotenv import load_dotenv
from pathlib import Path

# Evita erros de decodificação no terminal
sys.stdout.reconfigure(encoding='utf-8')

# Garante que acha o .env na raiz / configuração de caminhos
base_dir = Path(__file__).resolve().parent
root_dir = base_dir.parent.parent
env_path = root_dir / '.env'
load_dotenv(dotenv_path=env_path)

# Caminho onde a imagem será salva (pasta public do Node)
output_dir = root_dir / 'public' / 'relatorios'
output_file = output_dir / 'analise_performance.png'

# Cria a pasta se não existir
os.makedirs(output_dir, exist_ok=True)

# Schema do Banco
DB_SCHEMA = os.getenv("DB_SCHEMA", "public")

def gerar_graficos():
    print("Iniciando geração de relatório analítico...")
    
    # Conexão e Extração de Dados
    try:
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        
        query = f"""
            SELECT 
                r.nome as nome_regra,
                l.status_execucao,
                l.duracao_ms,
                l.data_execucao
            FROM {DB_SCHEMA}.log_execucoes_regras l
            JOIN {DB_SCHEMA}.regra r ON l.id_regra = r.id_regra
            ORDER BY l.data_execucao DESC
            LIMIT 1000 -- Analisar as últimas 1000 execuções
        """
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        if df.empty:
            print("Nenhum dado de log encontrado para gerar gráfico.")
            return

    except Exception as e:
        print(f"Erro ao ler dados: {e}")
        return

    # Processamento de Dados
    # Agrupar por Status (Sucesso)
    status_counts = df['status_execucao'].value_counts()
    
    # Filtra só o que foi sucesso para não "sujar" a média com timeouts
    df_sucesso = df[df['status_execucao'] == 'SUCESSO']
    perf_por_regra = df_sucesso.groupby('nome_regra')['duracao_ms'].mean().sort_values()

    # Visualização (Matplotlib)
    # Criamos uma figura com 2 gráficos (subplots)
    plt.style.use('ggplot')
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    fig.suptitle(f'Health Check do Runner - {len(df)} execuções analisadas', fontsize=16)

    # Gráfico de Pizza (Status de Saúde)
    colors = ['#4CAF50', '#F44336'] # Verde, Vermelho
    ax1.pie(status_counts, labels=status_counts.index, autopct='%1.1f%%', startangle=90, colors=colors)
    ax1.set_title('Taxa de Sucesso vs Falha')

    # Gráfico de Barra (Performance)
    if not perf_por_regra.empty:
        # 5 piores (tail pq ordenamos crescente)
        top_lentas = perf_por_regra.tail(5)
        top_lentas.plot(kind='barh', color='#214CA9', ax=ax2) # Conversação de pandas para plotagem
        ax2.set_title('Tempo Médio de Execução (ms)')
        ax2.set_xlabel('Milissegundos')
    else:
        ax2.text(0.5, 0.5, 'Sem dados de sucesso', ha='center')

    # Salvar
    plt.tight_layout()
    plt.savefig(output_file, dpi=100)
    print(f"✅ Relatório gerado com sucesso em: {output_file}")

if __name__ == "__main__":
    gerar_graficos()