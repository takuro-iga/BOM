from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import os
from io import BytesIO
import json
from datetime import datetime
import logging

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    handlers=[
        logging.FileHandler('/tmp/app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 現在のディレクトリから相対パスを作成
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
template_dir = os.path.join(base_dir, 'templates')
static_dir = os.path.join(base_dir, 'static')

logger.info(f"Template dir: {template_dir}")
logger.info(f"Static dir: {static_dir}")

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

# セキュリティ設定
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB
app.config['JSON_SORT_KEYS'] = False

# グローバル変数で部品展開マスタを保持
parts_master = None
parts_master_dict = {}

# 許可されるファイル形式
ALLOWED_EXTENSIONS = {'.xlsx', '.xls', '.csv'}
HEADER_ROW_MIN = 1
HEADER_ROW_MAX = 10

def validate_file_extension(filename):
    """ファイル拡張子を検証"""
    if not filename:
        return False
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS

def validate_header_row(header_row):
    """ヘッダー行番号を検証"""
    try:
        row = int(header_row)
        return HEADER_ROW_MIN <= row <= HEADER_ROW_MAX
    except (ValueError, TypeError):
        return False

def read_parts_master(file_path, header_row=0):
    """
    部品展開マスタファイルを読み込む
    """
    file_ext = os.path.splitext(file_path)[1].lower()
    
    logger.info(f"Reading file: {file_path}, ext: {file_ext}, header_row: {header_row}")
    
    if file_ext == '.csv':
        df = pd.read_csv(file_path, header=header_row)
    else:  # .xlsx, .xls
        df = pd.read_excel(file_path, header=header_row)
    
    # 列名を統一
    df.columns = ['完成品コード', '完成品商品名', '構成部品商品コード_確認用', 
                  '構成部品商品コード', '入数', '箱数', '構成数量']
    return df

def build_parts_master_dict(df):
    """
    部品展開マスタをツリー構造に変換
    """
    master_dict = {}
    for idx, row in df.iterrows():
        finished_code = str(row['完成品コード']).strip()
        finished_name = str(row['完成品商品名']).strip()
        part_code = str(row['構成部品商品コード']).strip()
        qty = int(row['構成数量'])
        
        if finished_code not in master_dict:
            master_dict[finished_code] = {
                'name': finished_name,
                'parts': []
            }
        
        master_dict[finished_code]['parts'].append({
            'code': part_code,
            'qty': qty,
            'input_qty': int(row['入数']) if pd.notna(row['入数']) else 0,
            'box_qty': int(row['箱数']) if pd.notna(row['箱数']) else 0
        })
    
    print(f"[{datetime.now()}] Built master dict with {len(master_dict)} finished products")
    return master_dict

@app.route('/')
def index():
    print(f"[{datetime.now()}] GET / - serving index.html")
    return render_template('index.html')

@app.route('/api/upload-master', methods=['POST'])
def upload_master():
    """部品展開マスタをアップロード"""
    global parts_master, parts_master_dict
    
    logger.info("POST /api/upload-master")
    
    if 'file' not in request.files:
        logger.warning("No file in request")
        return jsonify({'error': 'ファイルが指定されていません'}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("Empty filename")
        return jsonify({'error': 'ファイルが選択されていません'}), 400
    
    # ファイル拡張子を検証
    if not validate_file_extension(file.filename):
        logger.warning(f"Invalid file ext: {file.filename}")
        return jsonify({'error': 'ExcelまたはCSVファイル（.xlsx, .xls, .csv）をアップロードしてください'}), 400
    
    try:
        # ヘッダー行の取得と検証
        header_row = request.form.get('header_row', '1')
        if not validate_header_row(header_row):
            logger.warning(f"Invalid header row: {header_row}")
            return jsonify({'error': 'ヘッダー行は1～10の数値で指定してください'}), 400
        
        header_row = int(header_row) - 1  # 1ベースから0ベースに変換
        
        logger.info(f"Header row: {header_row}")
        
        # ファイルを一時保存して読み込み
        temp_path = f'/tmp/{file.filename}'
        file.save(temp_path)
        
        logger.info(f"Saved to {temp_path}")
        
        parts_master = read_parts_master(temp_path, header_row)
        parts_master_dict = build_parts_master_dict(parts_master)
        
        # 一時ファイル削除
        os.remove(temp_path)
        
        result = {
            'success': True,
            'message': f'マスタを読み込みました（{len(parts_master_dict)}個の完成品）',
            'count': len(parts_master_dict)
        }
        logger.info(f"Upload success: {len(parts_master_dict)} products")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Upload error: {str(e)}", exc_info=True)
        return jsonify({'error': f'ファイル読込エラー: {str(e)}'}), 400

@app.route('/api/master-data', methods=['GET'])
def get_master_data():
    """部品展開マスタの内容を取得"""
    logger.info("GET /api/master-data")
    
    if not parts_master_dict:
        logger.warning("No master data")
        return jsonify({'error': 'マスタが読み込まれていません'}), 400
    
    # 閲覧用にフォーマット
    formatted_data = []
    for finished_code, info in parts_master_dict.items():
        formatted_data.append({
            'finished_code': finished_code,
            'finished_name': info['name'],
            'parts': info['parts']
        })
    
    logger.info(f"Returning {len(formatted_data)} products")
    return jsonify({
        'success': True,
        'data': formatted_data,
        'total_finished_products': len(parts_master_dict)
    })

@app.route('/api/matching', methods=['POST'])
def matching():
    """完成品照合"""
    global parts_master_dict
    
    logger.info("POST /api/matching")
    
    if not parts_master_dict:
        logger.warning("No master data for matching")
        return jsonify({'error': 'マスタが読み込まれていません'}), 400
    
    if 'file' not in request.files:
        logger.warning("No file in matching request")
        return jsonify({'error': 'ファイルが指定されていません'}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("Empty filename in matching")
        return jsonify({'error': 'ファイルが選択されていません'}), 400
    
    # ファイル拡張子を検証
    if not validate_file_extension(file.filename):
        logger.warning(f"Invalid file ext in matching: {file.filename}")
        return jsonify({'error': 'ExcelまたはCSVファイル（.xlsx, .xls, .csv）をアップロードしてください'}), 400
    
    try:
        # ファイル読み込み
        temp_path = f'/tmp/{file.filename}'
        file.save(temp_path)
        
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext == '.csv':
            df = pd.read_csv(temp_path)
        else:
            df = pd.read_excel(temp_path)
        
        product_codes = df.iloc[:, 0].astype(str).str.strip().tolist()  # A列
        
        os.remove(temp_path)
        
        logger.info(f"Processing {len(product_codes)} codes")
        
        # 照合処理
        results = []
        matched_count = 0
        unmatched_count = 0
        
        for i, code in enumerate(product_codes):
            if code in parts_master_dict:
                results.append({
                    'row': i + 1,
                    'product_code': code,
                    'matched': True,
                    'finished_product_name': parts_master_dict[code]['name'],
                    'parts_count': len(parts_master_dict[code]['parts']),
                    'parts': parts_master_dict[code]['parts']
                })
                matched_count += 1
            else:
                results.append({
                    'row': i + 1,
                    'product_code': code,
                    'matched': False
                })
                unmatched_count += 1
        
        logger.info(f"Matching complete: {matched_count} matched, {unmatched_count} unmatched")
        return jsonify({
            'success': True,
            'results': results,
            'total': len(product_codes),
            'matched': matched_count,
            'unmatched': unmatched_count
        })
    except Exception as e:
        logger.error(f"Matching error: {str(e)}", exc_info=True)
        return jsonify({'error': f'ファイル処理エラー: {str(e)}'}), 400

@app.route('/api/export-matching', methods=['POST'])
def export_matching():
    """照合結果をExcelでエクスポート"""
    try:
        logger.info("POST /api/export-matching")
        
        data = request.json
        results = data.get('results', [])
        
        logger.info(f"Exporting {len(results)} results")
        
        # エクスポート用データを作成
        matched_rows = []
        unmatched_rows = []
        detail_rows = []
        
        for result in results:
            if result['matched']:
                matched_rows.append({
                    'Row': result['row'],
                    'Product Code': result['product_code'],
                    'Finished Product Name': result['finished_product_name'],
                    'Parts Count': result['parts_count']
                })
                
                # 詳細シート用
                if result['parts']:
                    for part in result['parts']:
                        detail_rows.append({
                            '完成品コード': result['product_code'],
                            '完成品商品名': result['finished_product_name'],
                            '構成部品商品コード': part['code'],
                            '入数': part['input_qty'],
                            '箱数': part['box_qty'],
                            '構成数量': part['qty']
                        })
                else:
                    detail_rows.append({
                        '完成品コード': result['product_code'],
                        '完成品商品名': result['finished_product_name'],
                        '構成部品商品コード': '',
                        '入数': '',
                        '箱数': '',
                        '構成数量': ''
                    })
            else:
                unmatched_rows.append({
                    'Row': result['row'],
                    'Product Code': result['product_code'],
                    'Status': 'Unmatched'
                })
        
        # Pandasで複数シートのExcelを作成
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            if matched_rows:
                pd.DataFrame(matched_rows).to_excel(writer, sheet_name='Matched', index=False)
            if unmatched_rows:
                pd.DataFrame(unmatched_rows).to_excel(writer, sheet_name='Unmatched', index=False)
            if detail_rows:
                detail_df = pd.DataFrame(detail_rows)
                detail_df.to_excel(writer, sheet_name='Detail', index=False)
        
        output.seek(0)
        logger.info(f"Export complete with {len(matched_rows)} matched and {len(unmatched_rows)} unmatched")
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='matching_results.xlsx'
        )
    except Exception as e:
        logger.error(f"Export error: {str(e)}", exc_info=True)
        return jsonify({'error': f'エクスポートエラー: {str(e)}'}), 400

if __name__ == '__main__':
    logger.info("Starting Flask app...")
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
