import json

def save_schema(schema_data, output_path):
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schema_data, f, ensure_ascii=False, indent=2)
    return output_path
