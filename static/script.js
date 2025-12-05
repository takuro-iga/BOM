// タブ切り替え
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        // すべてのタブを非表示
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // すべてのボタンから active クラスを削除
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 選択されたタブを表示
        document.getElementById(tabName).classList.add('active');
        e.target.classList.add('active');
    });
});

// マスタアップロード
document.getElementById('upload-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('master-file');
    const headerRow = parseInt(document.getElementById('header-row').value) || 1;
    const messageDiv = document.getElementById('upload-message');
    
    if (!fileInput.files.length) {
        showMessage(messageDiv, 'ファイルを選択してください', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('header_row', headerRow);
    
    try {
        const response = await fetch('/api/upload-master', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(messageDiv, data.message, 'success');
            fileInput.value = '';
            // マスタ閲覧タブのデータを自動更新
            loadMasterView();
        } else {
            showMessage(messageDiv, data.error, 'error');
        }
    } catch (error) {
        showMessage(messageDiv, `エラー: ${error.message}`, 'error');
    }
});

// マスタ閲覧
async function loadMasterView() {
    const container = document.getElementById('master-view-container');
    
    try {
        const response = await fetch('/api/master-data');
        const data = await response.json();
        
        if (!data.success) {
            container.innerHTML = `<p class="info-message">${data.error}</p>`;
            return;
        }
        
        if (!data.data || data.data.length === 0) {
            container.innerHTML = `<p class="info-message">マスタデータがありません</p>`;
            return;
        }
        
        // グローバル変数に保存
        window.allMasterData = data.data;
        window.totalFinishedProducts = data.total_finished_products;
        
        displayMasterData(data.data, data.total_finished_products);
    } catch (error) {
        container.innerHTML = `<p class="info-message" style="color: #dc3545;">エラー: ${error.message}</p>`;
    }
}

function displayMasterData(data, total) {
    const container = document.getElementById('master-view-container');
    
    let html = `<div class="matching-summary">
        <div class="summary-item">
            <div class="summary-label">完成品総数</div>
            <div class="summary-value total">${total}</div>
        </div>
    </div>`;
    
    html += '<div class="master-list">';
    
    data.forEach((item, index) => {
        const totalQty = item.parts.reduce((sum, p) => sum + p.qty, 0);
        
        html += `
            <div class="master-item">
                <div class="master-item-header" onclick="toggleParts(this)">
                    <div>
                        <h3>${item.finished_name}</h3>
                        <div class="master-item-code">コード: ${item.finished_code}</div>
                    </div>
                    <div class="toggle-icon">▶</div>
                </div>
                <div class="parts-list">
                    <p style="color: #6c757d; margin-bottom: 10px;">構成部品数: ${item.parts.length} / 合計数量: ${totalQty}</p>
                    <div class="parts-container">
        `;
        
        item.parts.forEach(part => {
            html += `
                <div class="part-item">
                    <div>
                        <div class="part-code">${part.code}</div>
                        <div style="color: #6c757d; font-size: 0.9em; margin-top: 3px;">
                            入数: ${part.input_qty} / 箱数: ${part.box_qty}
                        </div>
                    </div>
                    <div class="part-qty">数量: ${part.qty}個</div>
                </div>
            `;
        });
        
        html += `
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// 検索機能
document.getElementById('search-btn').addEventListener('click', performSearch);
document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

function performSearch() {
    const searchInput = document.getElementById('search-input').value.toLowerCase().trim();
    const container = document.getElementById('master-view-container');
    const infoDiv = document.getElementById('search-results-info');
    
    if (!searchInput) {
        showMessage(infoDiv, '検索キーワードを入力してください', 'error');
        return;
    }
    
    if (!window.allMasterData) {
        showMessage(infoDiv, 'マスタが読み込まれていません', 'error');
        return;
    }
    
    // フィルタリング
    const filtered = window.allMasterData.filter(item => {
        return item.finished_code.toLowerCase().includes(searchInput) ||
               item.finished_name.toLowerCase().includes(searchInput);
    });
    
    if (filtered.length === 0) {
        container.innerHTML = `<p class="info-message" style="color: #dc3545;">検索結果がありません</p>`;
        infoDiv.textContent = `「${searchInput}」の検索結果: 0件`;
        infoDiv.style.color = '#dc3545';
        return;
    }
    
    infoDiv.textContent = `「${searchInput}」の検索結果: ${filtered.length}件`;
    infoDiv.style.color = '#28a745';
    
    displayMasterData(filtered, filtered.length);
}

document.getElementById('clear-search-btn').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    document.getElementById('search-results-info').textContent = '';
    if (window.allMasterData) {
        displayMasterData(window.allMasterData, window.totalFinishedProducts);
    }
});

function toggleParts(headerElement) {
    const partsList = headerElement.nextElementSibling;
    const icon = headerElement.querySelector('.toggle-icon');
    
    partsList.classList.toggle('show');
    headerElement.classList.toggle('collapsed');
}

// 完成品照合
document.getElementById('matching-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('matching-file');
    const messageDiv = document.getElementById('matching-message');
    const resultsContainer = document.getElementById('matching-results-container');
    
    if (!fileInput.files.length) {
        showMessage(messageDiv, 'ファイルを選択してください', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        document.getElementById('matching-btn').disabled = true;
        showMessage(messageDiv, '照合中...', 'success');
        
        const response = await fetch('/api/matching', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(messageDiv, `照合完了: ${data.matched}件マッチ / ${data.unmatched}件未マッチ (合計: ${data.total}件)`, 'success');
            displayMatchingResults(data.results, resultsContainer);
            fileInput.value = '';
        } else {
            showMessage(messageDiv, data.error, 'error');
            resultsContainer.innerHTML = '';
        }
    } catch (error) {
        showMessage(messageDiv, `エラー: ${error.message}`, 'error');
        resultsContainer.innerHTML = '';
    } finally {
        document.getElementById('matching-btn').disabled = false;
    }
});

function displayMatchingResults(results, container) {
    const matched = results.filter(r => r.matched).length;
    const unmatched = results.filter(r => !r.matched).length;
    const total = results.length;
    
    const resultsJson = encodeURIComponent(JSON.stringify(results));
    
    let html = `
        <div class="matching-summary" style="margin-top: 30px;">
            <div class="summary-item">
                <div class="summary-label">マッチ件数</div>
                <div class="summary-value matched">${matched}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">未マッチ件数</div>
                <div class="summary-value unmatched">${unmatched}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">合計</div>
                <div class="summary-value total">${total}</div>
            </div>
        </div>
        
        <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
            <h3>詳細結果</h3>
            <button class="btn export-button" onclick="exportResults('${resultsJson}')">
                📊 Excelで出力
            </button>
        </div>
        
        <div class="matching-results">
    `;
    
    results.forEach(result => {
        if (result.matched) {
            // 構成部品情報を表示
            let partsHtml = '';
            if (result.parts && result.parts.length > 0) {
                const totalQty = result.parts.reduce((sum, p) => sum + p.qty, 0);
                partsHtml = `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e9ecef;">
                        <div style="color: #6c757d; font-size: 0.9em; margin-bottom: 8px;">
                            <strong>構成部品 (${result.parts.length}個):</strong>
                        </div>
                        <div style="display: grid; gap: 8px;">
                `;
                
                result.parts.forEach(part => {
                    partsHtml += `
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 3px solid #28a745;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600; color: #333;">コード: ${part.code}</div>
                                    <div style="color: #6c757d; font-size: 0.85em; margin-top: 3px;">
                                        入数: ${part.input_qty} / 箱数: ${part.box_qty}
                                    </div>
                                </div>
                                <div style="background: #e7f3ff; padding: 6px 12px; border-radius: 20px; color: #667eea; font-weight: 600;">
                                    構成数量: ${part.qty}個
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                partsHtml += `
                        </div>
                    </div>
                `;
            }
            
            html += `
                <div class="result-item">
                    <div class="result-header">
                        <div>
                            <div class="result-code">行${result.row}: ${result.product_code}</div>
                            <div class="result-details">
                                <p><strong>完成品名:</strong> ${result.finished_product_name}</p>
                            </div>
                            ${partsHtml}
                        </div>
                        <span class="result-status matched">✓ マッチ</span>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="result-item unmatched">
                    <div class="result-header">
                        <div class="result-code">行${result.row}: ${result.product_code}</div>
                        <span class="result-status unmatched">✗ 未マッチ</span>
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function exportResults(resultsJson) {
    // JSONから結果を復元
    const results = JSON.parse(decodeURIComponent(resultsJson));
    
    fetch('/api/export-matching', {
        method: 'POST',
        body: JSON.stringify({ results: results }),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'matching_results.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    })
    .catch(error => alert(`エクスポートエラー: ${error.message}`));
}

function showMessage(element, text, type) {
    element.textContent = text;
    element.className = `message show ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            element.classList.remove('show');
        }, 5000);
    }
}

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded');
    // loadMasterViewは呼ばない - ユーザーがマスタをアップロードしてから呼ぶ
});
