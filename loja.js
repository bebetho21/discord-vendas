// =====================================================
//   loja.js — Módulo de produtos/estoque por servidor
//   Cada servidor tem seus próprios arquivos em:
//     dados_loja/<guildId>_produtos.json
//     dados_loja/<guildId>_estoque.json
// =====================================================

const fs   = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'dados_loja');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

// -------------------------------------------------------
//   Helpers internos
// -------------------------------------------------------

function pathProdutos(guildId) {
    return path.join(DIR, `${guildId}_produtos.json`);
}
function pathEstoque(guildId) {
    return path.join(DIR, `${guildId}_estoque.json`);
}

function lerJSON(caminho, padrao) {
    if (!fs.existsSync(caminho)) return padrao;
    try { return JSON.parse(fs.readFileSync(caminho, 'utf-8')); }
    catch (e) { console.error(`[LOJA] Erro ao ler ${caminho}:`, e.message); return padrao; }
}
function salvarJSON(caminho, data) {
    try { fs.writeFileSync(caminho, JSON.stringify(data, null, 2)); }
    catch (e) { console.error(`[LOJA] Erro ao salvar ${caminho}:`, e.message); }
}

// -------------------------------------------------------
//   API pública
// -------------------------------------------------------

/**
 * Retorna o objeto de produtos do servidor.
 * Formato: { "<ID>": { id, nome, preco, descricao, imagem, variacoes[] } }
 */
function getProdutos(guildId) {
    return lerJSON(pathProdutos(guildId), {});
}

/**
 * Salva o objeto de produtos do servidor.
 */
function salvarProdutos(guildId, data) {
    salvarJSON(pathProdutos(guildId), data);
}

/**
 * Retorna o objeto de estoque do servidor.
 * Formato: { "<produtoId>": ["item1", "item2", ...] }
 */
function getEstoque(guildId) {
    return lerJSON(pathEstoque(guildId), {});
}

/**
 * Salva o objeto de estoque do servidor.
 */
function salvarEstoque(guildId, data) {
    salvarJSON(pathEstoque(guildId), data);
}

module.exports = { getProdutos, salvarProdutos, getEstoque, salvarEstoque };
