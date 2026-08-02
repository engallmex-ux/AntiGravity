import sqlite3
import os
import json
from pathlib import Path

def init_db(db_path):
    """Inicializa a estrutura relacional do banco de dados SQLite pronta para Grafana."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Tabela 1: Ordens de Serviço (Snapshot e Métricas para Grafana)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS os_gets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_os TEXT UNIQUE,
        data_abertura DATETIME,
        dias_aberto INTEGER,
        status_sigla TEXT,
        status_descricao TEXT,
        tempo_no_estado_dias INTEGER,
        patrimonio TEXT,
        tag_setor TEXT,
        nome_equipamento TEXT,
        marca TEXT,
        modelo TEXT,
        tecnico_responsavel TEXT,
        unidade_setor TEXT,
        data_captura DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Tabela 2: Equipamentos / Inventário
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS inventario_equipamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patrimonio TEXT UNIQUE,
        tag_setor TEXT,
        nome TEXT,
        marca TEXT,
        modelo TEXT,
        localizacao TEXT,
        status_operacional TEXT,
        ultima_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Tabela 3: Histórico de Auditoria e Mapeamento de Rotas
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS auditoria_navegacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        url_alvo TEXT,
        paginas_visitadas INTEGER,
        status TEXT,
        schema_json TEXT
    )
    ''')

    # Views para Grafana
    cursor.execute('''
    CREATE VIEW IF NOT EXISTS v_kpi_os_por_status AS
    SELECT status_sigla, status_descricao, COUNT(*) as total_os, AVG(dias_aberto) as media_dias_aberto
    FROM os_gets
    GROUP BY status_sigla, status_descricao
    ''')

    conn.commit()
    conn.close()
    return db_path

def save_os_to_db(db_path, os_records):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    inserted = 0
    for item in os_records:
        try:
            cursor.execute('''
            INSERT OR REPLACE INTO os_gets 
            (numero_os, data_abertura, dias_aberto, status_sigla, status_descricao, tempo_no_estado_dias, patrimonio, tag_setor, nome_equipamento, marca, modelo, tecnico_responsavel, unidade_setor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                item.get("numero_os"),
                item.get("data_abertura"),
                item.get("dias_aberto", 0),
                item.get("status_sigla"),
                item.get("status_descricao"),
                item.get("tempo_no_estado_dias", 0),
                item.get("patrimonio"),
                item.get("tag_setor"),
                item.get("nome_equipamento"),
                item.get("marca"),
                item.get("modelo"),
                item.get("tecnico_responsavel"),
                item.get("unidade_setor")
            ))
            inserted += 1
        except Exception:
            pass
    conn.commit()
    conn.close()
    return inserted
