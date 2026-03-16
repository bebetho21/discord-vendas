// =====================================================
//   BOT DE LOJA — discord.js v14 | Prefixo: !
//   ZStore
// =====================================================

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionsBitField
} = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// =====================================================
//   CLIENT
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel]
});

// =====================================================
//   ARQUIVOS DE DADOS
// =====================================================

const loja = require('./loja');
const CONFIG_FILE    = './config_loja.json';
const LICENCAS_FILE  = './licencas.json';

function lerArquivo(caminho, padrao) {
    if (!fs.existsSync(caminho)) fs.writeFileSync(caminho, JSON.stringify(padrao, null, 2));
    try { return JSON.parse(fs.readFileSync(caminho, 'utf-8')); }
    catch (e) { console.error(`[ERRO] Leitura de ${caminho}:`, e.message); return padrao; }
}
function salvarArquivo(caminho, data) {
    try { fs.writeFileSync(caminho, JSON.stringify(data, null, 2)); }
    catch (e) { console.error(`[ERRO] Escrita em ${caminho}:`, e.message); }
}

let config    = lerArquivo(CONFIG_FILE, {
    chave_pix:       'SUA_CHAVE_PIX_AQUI',
    nome_dono:       'ZStore',
    cargo_staff:     null,
    cargo_cliente:   null,
    canal_feedbacks: null,
    canal_vendas:    null,
    canal_logs:      null,
    licenca_chave:   null
});

const salvarConfig   = () => salvarArquivo(CONFIG_FILE, config);

// =====================================================
//   SISTEMA DE LICENÇA
// =====================================================

/** Tempo de validade das licenças em dias. Altere aqui para ajustar. */
const VALIDADE_DIAS = 30;

/**
 * Lê o arquivo de licenças.
 * Estrutura: { "CHAVE": { usada: bool, guildId: string|null, ativadaEm: string|null } }
 */
function lerLicencas() {
    return lerArquivo(LICENCAS_FILE, {});
}

/** Salva o arquivo de licenças. */
function salvarLicencas(data) {
    salvarArquivo(LICENCAS_FILE, data);
}

/**
 * Verifica se uma entrada de licença já expirou.
 * Retorna true se a data de ativação + VALIDADE_DIAS < agora.
 */
function licencaExpirada(entrada) {
    if (!entrada?.ativadaEm) return false;
    const ativadaEm  = new Date(entrada.ativadaEm).getTime();
    const expiraEm   = ativadaEm + VALIDADE_DIAS * 24 * 60 * 60 * 1000;
    return Date.now() > expiraEm;
}

/**
 * Revoga uma licença (reseta para não-usada).
 * Chamado automaticamente quando a licença expira.
 */
function revogarLicenca(chave) {
    const licencas = lerLicencas();
    if (!licencas[chave]) return;
    licencas[chave] = { usada: false, guildId: null, ativadaEm: null };
    salvarLicencas(licencas);
    // Limpa a chave do config do servidor
    config.licenca_chave = null;
    salvarConfig();
    console.log(`[LICENÇA] Licença ${chave} expirada e revogada automaticamente.`);
}

/**
 * Valida uma chave de licença para um guild.
 * Retorna: { ok: true } | { ok: false, erro: 'invalida' | 'em_uso' | 'ja_ativa' | 'expirada' }
 * Também revoga automaticamente licenças expiradas.
 */
function validarLicenca(chave, guildId) {
    const licencas = lerLicencas();
    const chaveUp  = chave.toUpperCase();
    const entrada  = licencas[chaveUp];

    if (!entrada) return { ok: false, erro: 'invalida' };

    // Se expirou, revoga e rejeita
    if (entrada.usada && licencaExpirada(entrada)) {
        revogarLicenca(chaveUp);
        return { ok: false, erro: 'expirada' };
    }

    if (entrada.usada && entrada.guildId !== guildId) return { ok: false, erro: 'em_uso' };
    if (entrada.usada && entrada.guildId === guildId)  return { ok: false, erro: 'ja_ativa' };

    return { ok: true };
}

/**
 * Registra uma licença como usada pelo guild informado.
 * Salva a data de ativação para controle de expiração.
 */
function registrarLicenca(chave, guildId) {
    const licencas = lerLicencas();
    licencas[chave.toUpperCase()] = {
        usada:     true,
        guildId:   guildId,
        ativadaEm: new Date().toISOString()
    };
    salvarLicencas(licencas);
}

/**
 * Verifica se o servidor tem uma licença ativa e não expirada.
 * Se estiver expirada, revoga automaticamente e retorna false.
 * Retorna: true | false | 'expirada' (para diferenciar o motivo)
 */
function servidorLicenciado(guildId) {
    if (!config.licenca_chave) return false;

    const chaveUp  = config.licenca_chave.toUpperCase();
    const licencas = lerLicencas();
    const entrada  = licencas[chaveUp];

    if (!entrada || !entrada.usada || entrada.guildId !== guildId) return false;

    // Verifica expiração
    if (licencaExpirada(entrada)) {
        revogarLicenca(chaveUp);
        return 'expirada';
    }

    return true;
}

/** Retorna a data de expiração formatada em pt-BR dado a data de ativação */
function dataExpiracao(ativadaEm) {
    const expira = new Date(new Date(ativadaEm).getTime() + VALIDADE_DIAS * 24 * 60 * 60 * 1000);
    return expira.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Embed: licença não ativada */
function embedSemLicenca() {
    return new EmbedBuilder()
        .setTitle('🔒 Licença Não Ativada')
        .setDescription('Este servidor ainda não possui uma licença ativa.\nUse o comando abaixo para ativar:')
        .addFields({ name: '📋 Comando', value: '`!ativar <sua-chave>`' })
        .setColor('Red')
        .setFooter({ text: 'ZStore • Sistema de Licença' });
}

/** Embed: licença expirada */
function embedLicencaExpirada() {
    return new EmbedBuilder()
        .setTitle('⚠️ Licença Expirada')
        .setDescription(`A licença deste servidor expirou após **${VALIDADE_DIAS} dias**.\nRenove ativando uma nova chave:`)
        .addFields({ name: '📋 Comando', value: '`!ativar <nova-chave>`' })
        .setColor('Orange')
        .setFooter({ text: 'ZStore • Sistema de Licença' });
}

/** Embed: sucesso ao ativar */
function embedLicencaOk(chave, ativadaEm) {
    const expira = dataExpiracao(ativadaEm);
    return new EmbedBuilder()
        .setTitle('✅ Licença Ativada com Sucesso!')
        .setDescription(`Seu servidor agora tem acesso completo ao **ZStore Bot** por **${VALIDADE_DIAS} dias**.`)
        .addFields(
            { name: '🔑 Chave',       value: `\`${chave}\``, inline: true },
            { name: '📅 Expira em',   value: expira,          inline: true }
        )
        .setColor('Green')
        .setTimestamp()
        .setFooter({ text: 'ZStore • Sistema de Licença' });
}

/** Embed: erro de licença */
function embedLicencaErro(tipo) {
    const mensagens = {
        invalida:  { titulo: '❌ Chave Inválida',   desc: 'A chave informada não existe. Verifique e tente novamente.' },
        em_uso:    { titulo: '⛔ Licença em Uso',   desc: 'Esta chave já está sendo utilizada em outro servidor.' },
        ja_ativa:  { titulo: '⚠️ Licença Já Ativa', desc: 'Esta chave já está ativa neste servidor.' },
        expirada:  { titulo: '⏰ Licença Expirada', desc: 'Esta chave expirou. Utilize outra chave válida.' }
    };
    const { titulo, desc } = mensagens[tipo] || { titulo: '❌ Erro', desc: 'Erro desconhecido.' };
    return new EmbedBuilder()
        .setTitle(titulo)
        .setDescription(desc)
        .setColor('Red')
        .setFooter({ text: 'ZStore • Sistema de Licença' });
}

// =====================================================
//   ESTADO EM MEMÓRIA
// =====================================================

/**
 * tickets[canalId] = {
 *   produtoId : string
 *   variacao  : string | null
 *   userId    : string
 *   entregue  : boolean
 *   avaliou   : boolean
 * }
 */
const tickets    = {};
const painelState = {};
const ultimoProdutoCriado = {};

// =====================================================
//   UTILITÁRIOS GERAIS
// =====================================================

const isAdmin = m => m.permissions.has(PermissionsBitField.Flags.Administrator);
const isStaff = m => isAdmin(m) || !!(config.cargo_staff && m.roles.cache.has(config.cargo_staff));

const gerarId = () => Date.now().toString(36).toUpperCase();

function resolverCanal(guild, idSalvo, nomeFallback) {
    if (idSalvo) {
        const c = guild.channels.cache.get(idSalvo);
        if (c && c.type === ChannelType.GuildText) return c;
    }
    return guild.channels.cache.find(c =>
        c.type === ChannelType.GuildText &&
        c.name.toLowerCase().includes(nomeFallback.toLowerCase())
    ) || null;
}

function embedProduto(p, guildId) {
    const estoqueGuild = loja.getEstoque(guildId);
    const qtd = (estoqueGuild[p.id] || []).length;
    const embed = new EmbedBuilder()
        .setTitle(`🛒 ${p.nome}`)
        .setDescription(p.descricao || '\u200B')
        .addFields(
            { name: '💰 Preço',   value: `R$ ${p.preco}`,     inline: true },
            { name: '📦 Estoque', value: `${qtd} unidade(s)`, inline: true }
        )
        .setColor('Gold')
        .setFooter({ text: `${config.nome_dono} • Pagamento via PIX` });
    if (p.imagem) embed.setImage(p.imagem);
    return embed;
}

function componentesProduto(p) {
    const rows = [];
    if (Array.isArray(p.variacoes) && p.variacoes.length > 1) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`var_${p.id}`)
                .setPlaceholder('Selecione uma variação...')
                .addOptions(p.variacoes.map((v, i) => ({ label: v, value: String(i) })))
        ));
    }
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`comprar_${p.id}`).setLabel('🛒 Comprar').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`info_${p.id}`).setLabel('ℹ️ Informações').setStyle(ButtonStyle.Secondary)
    ));
    return rows;
}

function buildAvaliacaoModal(canalId) {
    return new ModalBuilder()
        .setCustomId(`avaliacao_modal_${canalId}`)
        .setTitle('⭐ Avalie sua Compra — ZStore')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('nota')
                    .setLabel('Nota de 1 a 5 (ex: 5)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('5')
                    .setMinLength(1)
                    .setMaxLength(1)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('comentario')
                    .setLabel('Comentário sobre sua compra')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Conte como foi sua experiência...')
                    .setMinLength(5)
                    .setMaxLength(500)
                    .setRequired(true)
            )
        );
}

// =====================================================
//   READY
// =====================================================

client.on('ready', () => console.log(`✅ ${client.user.tag} online!`));

// =====================================================
//   COMANDOS DE TEXTO
// =====================================================

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const cmd  = args.shift().toLowerCase();
    const filterUser = m => m.author.id === message.author.id && m.channel.id === message.channel.id;

    async function perguntar(texto, timeout = 60000) {
        await message.channel.send(texto);
        const col = await message.channel
            .awaitMessages({ filter: filterUser, max: 1, time: timeout })
            .catch(() => null);
        return col?.first()?.content ?? null;
    }

    // Contexto do servidor — produtos e estoque isolados por guildId
    const guildId  = message.guild.id;
    const produtos = loja.getProdutos(guildId);
    const estoque  = loja.getEstoque(guildId);

    // Comandos abertos (sem licença): helpbot e ativar
    const cmdsSemLicenca = ['helpbot', 'ativar'];

    // Verifica licença para todos os outros comandos
    if (!cmdsSemLicenca.includes(cmd)) {
        const statusLicenca = servidorLicenciado(message.guild.id);
        if (statusLicenca === 'expirada')
            return message.reply({ embeds: [embedLicencaExpirada()] });
        if (statusLicenca !== true)
            return message.reply({ embeds: [embedSemLicenca()] });
    }

    // -------------------------------------------------------
    //   !helpbot
    // -------------------------------------------------------
    if (cmd === 'helpbot') {
        const statusLicenca = servidorLicenciado(message.guild.id);
        let statusTexto;
        if (statusLicenca === true) {
            // Mostra a data de expiração no footer
            const licencas = lerLicencas();
            const entrada  = config.licenca_chave ? licencas[config.licenca_chave.toUpperCase()] : null;
            statusTexto = entrada?.ativadaEm
                ? `✅ Licença Ativa • Expira em ${dataExpiracao(entrada.ativadaEm)}`
                : '✅ Licença Ativa';
        } else if (statusLicenca === 'expirada') {
            statusTexto = '⏰ Licença Expirada — use !ativar <nova-chave>';
        } else {
            statusTexto = '❌ Sem Licença — use !ativar <chave>';
        }

        const embed = new EmbedBuilder()
            .setTitle('📖 Comandos — ZStore')
            .setColor('Gold')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '🔑 Licença', value: '`!ativar <chave>` — Ativa a licença do servidor', inline: false },
                { name: '🛒 Loja', value: '`!painelloja` — Envia produto em um canal\n`!enviaranuncio` — Reenvia o último produto criado', inline: false },
                { name: '📦 Produtos (Staff)', value: '`!criarproduto` — Cria produto\n`!editarproduto` — Edita produto\n`!removerproduto` — Remove produto\n`!listarprodutos` — Lista produtos', inline: false },
                { name: '📦 Estoque (Staff)', value: '`!adicionarestoque` — Adiciona item\n`!verestoque` — Ver estoque', inline: false },
                { name: '🛠️ Moderação (Staff)', value: '`!clear <qtd>` — Apaga mensagens', inline: false },
                { name: '⚙️ Config (Admin)', value: '`!setpix <chave>` — Chave PIX\n`!setstaff @cargo` — Cargo staff\n`!setcliente @cargo` — Cargo após compra\n`!setnome <nome>` — Nome da loja\n`!setfeedbacks <#canal>` — Canal avaliações\n`!setvendas <#canal>` — Canal vendas\n`!setlogs <#canal>` — Canal logs', inline: false }
            )
            .setFooter({ text: `ZStore • ${statusTexto}` });
        return message.channel.send({ embeds: [embed] });
    }

    // -------------------------------------------------------
    //   !ativar <chave>
    // -------------------------------------------------------
    if (cmd === 'ativar') {
        if (!isAdmin(message.member))
            return message.reply('❌ Apenas administradores podem ativar a licença.');

        const chave = args[0];
        if (!chave)
            return message.reply('❌ Informe a chave. Exemplo: `!ativar ZSTORE-DEMO-2024`');

        const resultado = validarLicenca(chave, message.guild.id);

        if (!resultado.ok)
            return message.reply({ embeds: [embedLicencaErro(resultado.erro)] });

        const agora = new Date().toISOString();
        registrarLicenca(chave, message.guild.id);
        config.licenca_chave = chave.toUpperCase();
        salvarConfig();

        return message.reply({ embeds: [embedLicencaOk(chave.toUpperCase(), agora)] });
    }

    // -------------------------------------------------------
    //   !clear <quantidade>
    // -------------------------------------------------------
    if (cmd === 'clear') {
        if (!isStaff(message.member)) return message.reply('❌ Sem permissão.');

        const quantidade = parseInt(args[0]);
        if (isNaN(quantidade) || quantidade < 1 || quantidade > 100)
            return message.reply('❌ Informe uma quantidade entre **1** e **100**. Ex: `!clear 10`');

        await message.delete().catch(() => {});
        const deletadas = await message.channel.bulkDelete(quantidade, true).catch(() => null);
        if (!deletadas)
            return message.channel.send('❌ Não foi possível apagar. Mensagens com mais de 14 dias não podem ser apagadas em massa.');

        const aviso = await message.channel.send(`🗑️ **${deletadas.size}** mensagem(ns) apagada(s).`);
        setTimeout(() => aviso.delete().catch(() => {}), 3000);
        return;
    }

    // -------------------------------------------------------
    //   !painelloja
    // -------------------------------------------------------
    if (cmd === 'painelloja') {
        if (!isStaff(message.member)) return message.reply('❌ Sem permissão.');
        const lista = Object.values(produtos);
        if (lista.length === 0)
            return message.reply('❌ Nenhum produto cadastrado. Use `!criarproduto` primeiro.');

        if (lista.length === 1) {
            painelState[message.author.id] = { produtoId: lista[0].id };
            return message.reply({
                content: `📦 **${lista[0].nome}** selecionado! Escolha o canal:`,
                components: [new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('painel_canal')
                        .setPlaceholder('Selecione o canal...')
                        .addChannelTypes(ChannelType.GuildText)
                )]
            });
        }

        return message.reply({
            content: '📋 Escolha o produto para anunciar:',
            components: [new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('painel_produto')
                    .setPlaceholder('Selecione o produto...')
                    .addOptions(lista.slice(0, 25).map(p => ({
                        label: p.nome,
                        description: `R$ ${p.preco}`,
                        value: p.id,
                        emoji: '📦'
                    })))
            )]
        });
    }

    // -------------------------------------------------------
    //   !enviaranuncio
    // -------------------------------------------------------
    if (cmd === 'enviaranuncio') {
        if (!isStaff(message.member)) return message.reply('❌ Sem permissão.');
        if (!ultimoProdutoCriado[guildId] || !produtos[ultimoProdutoCriado[guildId]])
            return message.reply('❌ Nenhum produto criado ainda. Use `!criarproduto`.');

        painelState[message.author.id] = { produtoId: ultimoProdutoCriado[guildId] };
        return message.reply({
            content: `📢 Enviando **${produtos[ultimoProdutoCriado[guildId]].nome}**. Escolha o canal:`,
            components: [new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('painel_canal')
                    .setPlaceholder('Selecione o canal...')
                    .addChannelTypes(ChannelType.GuildText)
            )]
        });
    }

    // -------------------------------------------------------
    //   !criarproduto
    // -------------------------------------------------------
    if (cmd === 'criarproduto') {
        if (!isStaff(message.member)) return message.reply('❌ Sem permissão.');

        const nome = await perguntar('📦 **Nome do produto:**');
        if (!nome) return message.channel.send('⏰ Tempo esgotado.');

        const preco = await perguntar('💰 **Preço** (ex: 9,99):');
        if (!preco) return message.channel.send('⏰ Tempo esgotado.');

        const descricao = await perguntar('📝 **Descrição do produto:**');
        if (!descricao) return message.channel.send('⏰ Tempo esgotado.');

        const imgResp = await perguntar('🖼️ **URL da foto** (ou `pular`):');
        if (!imgResp) return message.channel.send('⏰ Tempo esgotado.');
        const imagem = (imgResp.toLowerCase() === 'pular' || !imgResp.startsWith('http'))
            ? null : imgResp.trim();

        const varResp = await perguntar('🎛️ **Variações** separadas por vírgula (ex: `Azul, Vermelho`)\nDigite `pular` se não houver:');
        if (!varResp) return message.channel.send('⏰ Tempo esgotado.');
        const variacoes = varResp.toLowerCase() === 'pular'
            ? [] : varResp.split(',').map(v => v.trim()).filter(Boolean);

        const id = gerarId();
        produtos[id] = { id, nome, preco, descricao, imagem, variacoes };
        loja.salvarProdutos(guildId, produtos);
        ultimoProdutoCriado[guildId] = id;

        const embed = new EmbedBuilder()
            .setTitle('✅ Produto Criado!')
            .setColor('Green')
            .addFields(
                { name: 'Nome',         value: nome,                                     inline: true },
                { name: 'Preço',        value: `R$ ${preco}`,                            inline: true },
                { name: 'ID',           value: id,                                       inline: true },
                { name: 'Descrição',    value: descricao },
                { name: '🖼️ Foto',      value: imagem ? '✅ Definida' : '❌ Sem foto',  inline: true },
                { name: '🎛️ Variações', value: variacoes.length ? variacoes.join(', ') : 'Nenhuma', inline: true }
            );
        if (imagem) embed.setImage(imagem);
        return message.channel.send({ embeds: [embed] });
    }

    // -------------------------------------------------------
    //   !editarproduto
    // -------------------------------------------------------
    if (cmd === 'editarproduto') {
        if (!isStaff(message.member)) return message.reply('❌ Sem permissão.');
        const lista = Object.values(produtos);
        if (lista.length === 0) return message.reply('❌ Nenhum produto cadastrado.');

        const txt   = lista.map(p => `**${p.id}** — ${p.nome}`).join('\n');
        const idEsc = await perguntar(`📋 Produtos:\n${txt}\n\nDigite o **ID** do produto:`);
        if (!idEsc) return message.channel.send('⏰ Tempo esgotado.');

        const produto = produtos[idEsc.trim().toUpperCase()];
        if (!produto) return message.channel.send('❌ Produto não encontrado.');

        const campo = await perguntar('Campo a editar: `nome` / `preco` / `descricao` / `imagem` / `variacoes`');
        if (!campo) return message.channel.send('⏰ Tempo esgotado.');

        const c = campo.toLowerCase().trim();
        if (!['nome','preco','descricao','imagem','variacoes'].includes(c))
            return message.channel.send('❌ Campo inválido.');

        const novoVal = await perguntar(`✏️ Novo valor para **${c}** (ou "pular" para limpar):`);
        if (!novoVal) return message.channel.send('⏰ Tempo esgotado.');

        if (c === 'imagem') {
            produto.imagem = novoVal.toLowerCase() === 'pular' ? null : novoVal.trim();
        } else if (c === 'variacoes') {
            produto.variacoes = novoVal.toLowerCase() === 'pular'
                ? [] : novoVal.split(',').map(v => v.trim()).filter(Boolean);
        } else {
            produto[c] = novoVal;
        }
        loja.salvarProdutos(guildId, produtos);
        return message.channel.send(`✅ Produto **${produto.nome}** atualizado!`);
    }

    // -------------------------------------------------------
    //   !removerproduto
    // -------------------------------------------------------
    if (cmd === 'removerproduto') {
        if (!isStaff(message.member)) return message.reply('❌ Sem permissão.');
        const lista = Object.values(produtos);
        if (lista.length === 0) return message.reply('❌ Nenhum produto cadastrado.');

        const txt   = lista.map(p => `**${p.id}** — ${p.nome}`).join('\n');
        const idEsc = await perguntar(`🗑️ Produtos:\n${txt}\n\nDigite o **ID** a remover:`);
        if (!idEsc) return message.channel.send('⏰ Tempo esgotado.');

        const id = idEsc.trim().toUpperCase();
        if (!produtos[id]) return message.channel.send('❌ Produto não encontrado.');
        const nome = produtos[id].nome;
        delete produtos[id];
        delete estoque[id];
        loja.salvarProdutos(guildId, produtos);
        loja.salvarEstoque(guildId, estoque);
        return message.channel.send(`✅ Produto **${nome}** removido!`);
    }

    // -------------------------------------------------------
    //   !listarprodutos
    // -------------------------------------------------------
    if (cmd === 'listarprodutos') {
        if (!isStaff(message.member)) return message.reply('❌ Sem permissão.');
        const lista = Object.values(produtos);
        if (lista.length === 0) return message.reply('❌ Nenhum produto cadastrado.');

        const embed = new EmbedBuilder().setTitle('📋 Produtos Cadastrados').setColor('Blue');
        lista.forEach(p => {
            const qtd = (estoque[p.id] || []).length;
            embed.addFields({
                name:  `📦 ${p.nome} (ID: ${p.id})`,
                value: `💰 R$ ${p.preco} | 📦 ${qtd} unid.\n${p.imagem ? '🖼️ Com foto' : '🚫 Sem foto'} | 🎛️ ${p.variacoes?.length ? p.variacoes.join(', ') : 'Sem variações'}\n${p.descricao}`,
                inline: false
            });
        });
        return message.channel.send({ embeds: [embed] });
    }

    // -------------------------------------------------------
    //   !adicionarestoque
    // -------------------------------------------------------
    if (cmd === 'adicionarestoque') {
        if (!isStaff(message.member)) return message.reply('❌ Sem permissão.');
        const lista = Object.values(produtos);
        if (lista.length === 0) return message.reply('❌ Nenhum produto cadastrado.');

        const txt   = lista.map(p => `**${p.id}** — ${p.nome}`).join('\n');
        const idEsc = await perguntar(`📦 Produtos:\n${txt}\n\nDigite o **ID**:`);
        if (!idEsc) return message.channel.send('⏰ Tempo esgotado.');

        const id = idEsc.trim().toUpperCase();
        if (!produtos[id]) return message.channel.send('❌ Produto não encontrado.');

        const item = await perguntar('📝 Digite o item (código, link, senha, etc):');
        if (!item) return message.channel.send('⏰ Tempo esgotado.');

        if (!estoque[id]) estoque[id] = [];
        estoque[id].push(item.trim());
        loja.salvarEstoque(guildId, estoque);
        return message.channel.send(`✅ Item adicionado em **${produtos[id].nome}**! Total: ${estoque[id].length}`);
    }

    // -------------------------------------------------------
    //   !verestoque
    // -------------------------------------------------------
    if (cmd === 'verestoque') {
        if (!isStaff(message.member)) return message.reply('❌ Sem permissão.');
        const lista = Object.values(produtos);
        if (lista.length === 0) return message.reply('❌ Nenhum produto cadastrado.');

        const embed = new EmbedBuilder().setTitle('📦 Estoque Atual').setColor('Blue');
        lista.forEach(p => embed.addFields({
            name:   p.nome,
            value:  `${(estoque[p.id] || []).length} unidade(s)`,
            inline: true
        }));
        return message.channel.send({ embeds: [embed] });
    }

    // -------------------------------------------------------
    //   CONFIG (Admin)
    // -------------------------------------------------------
    if (cmd === 'setpix') {
        if (!isAdmin(message.member)) return message.reply('❌ Apenas administradores.');
        config.chave_pix = args.join(' ');
        salvarConfig();
        return message.reply(`✅ Chave PIX: \`${config.chave_pix}\``);
    }
    if (cmd === 'setstaff') {
        if (!isAdmin(message.member)) return message.reply('❌ Apenas administradores.');
        const role = message.mentions.roles.first() || { id: args[0] };
        if (!role?.id) return message.reply('❌ Mencione o cargo ou forneça o ID.');
        config.cargo_staff = role.id;
        salvarConfig();
        return message.reply(`✅ Cargo de staff: <@&${config.cargo_staff}>`);
    }
    if (cmd === 'setcliente') {
        if (!isAdmin(message.member)) return message.reply('❌ Apenas administradores.');
        const role = message.mentions.roles.first() || { id: args[0] };
        if (!role?.id) return message.reply('❌ Mencione o cargo ou forneça o ID.');
        config.cargo_cliente = role.id;
        salvarConfig();
        return message.reply(`✅ Cargo de cliente: <@&${config.cargo_cliente}>`);
    }
    if (cmd === 'setnome') {
        if (!isAdmin(message.member)) return message.reply('❌ Apenas administradores.');
        config.nome_dono = args.join(' ');
        salvarConfig();
        return message.reply(`✅ Nome da loja: **${config.nome_dono}**`);
    }
    if (cmd === 'setfeedbacks') {
        if (!isAdmin(message.member)) return message.reply('❌ Apenas administradores.');
        const canal = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
        if (!canal) return message.reply('❌ Mencione o canal ou forneça o ID.');
        config.canal_feedbacks = canal.id;
        salvarConfig();
        return message.reply(`✅ Canal de feedbacks: ${canal}`);
    }
    if (cmd === 'setvendas') {
        if (!isAdmin(message.member)) return message.reply('❌ Apenas administradores.');
        const canal = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
        if (!canal) return message.reply('❌ Mencione o canal ou forneça o ID.');
        config.canal_vendas = canal.id;
        salvarConfig();
        return message.reply(`✅ Canal de vendas: ${canal}`);
    }
    if (cmd === 'setlogs') {
        if (!isAdmin(message.member)) return message.reply('❌ Apenas administradores.');
        const canal = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
        if (!canal) return message.reply('❌ Mencione o canal ou forneça o ID.');
        config.canal_logs = canal.id;
        salvarConfig();
        return message.reply(`✅ Canal de logs: ${canal}`);
    }
});

// =====================================================
//   INTERAÇÕES (Botões + Menus + Modais)
// =====================================================

client.on('interactionCreate', async (interaction) => {
    try {

    // Contexto do servidor — produtos e estoque isolados por guildId
    const guildId  = interaction.guild?.id;
    const produtos = guildId ? loja.getProdutos(guildId) : {};
    const estoque  = guildId ? loja.getEstoque(guildId)  : {};

    // ---------------------------------------------------
    //   SELECT: painel_produto
    // ---------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === 'painel_produto') {
        if (!isStaff(interaction.member))
            return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

        painelState[interaction.user.id] = { produtoId: interaction.values[0] };
        return interaction.update({
            content: '📺 Produto selecionado! Agora escolha o canal:',
            components: [new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('painel_canal')
                    .setPlaceholder('Selecione o canal...')
                    .addChannelTypes(ChannelType.GuildText)
            )]
        });
    }

    // ---------------------------------------------------
    //   CHANNEL SELECT: painel_canal
    // ---------------------------------------------------
    if (interaction.isChannelSelectMenu() && interaction.customId === 'painel_canal') {
        if (!isStaff(interaction.member))
            return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

        const state = painelState[interaction.user.id];
        if (!state?.produtoId)
            return interaction.reply({ content: '❌ Estado expirado. Rode o comando novamente.', ephemeral: true });

        const produto = produtos[state.produtoId];
        if (!produto)
            return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });

        const canal = interaction.guild.channels.cache.get(interaction.values[0]);
        if (!canal)
            return interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });

        await canal.send({ embeds: [embedProduto(produto, guildId)], components: componentesProduto(produto) });
        delete painelState[interaction.user.id];
        return interaction.update({ content: `✅ Produto **${produto.nome}** enviado para ${canal}!`, components: [] });
    }

    // ---------------------------------------------------
    //   SELECT: var_<id> — variação do produto
    // ---------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('var_')) {
        await interaction.deferUpdate();
        const produtoId = interaction.customId.replace('var_', '');
        if (!painelState[interaction.user.id]) painelState[interaction.user.id] = {};
        painelState[interaction.user.id].variacaoIdx     = interaction.values[0];
        painelState[interaction.user.id].produtoIdCompra = produtoId;
        return;
    }

    // ---------------------------------------------------
    //   BOTÃO: info_<id>
    // ---------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith('info_')) {
        const produto = produtos[interaction.customId.replace('info_', '')];
        if (!produto)
            return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });

        const qtd = (estoque[produto.id] || []).length;
        const embed = new EmbedBuilder()
            .setTitle(`ℹ️ ${produto.nome}`)
            .setDescription(produto.descricao)
            .addFields(
                { name: '💰 Preço',   value: `R$ ${produto.preco}`, inline: true },
                { name: '📦 Estoque', value: `${qtd} unidade(s)`,  inline: true }
            )
            .setColor('Blue');
        if (produto.imagem) embed.setImage(produto.imagem);
        if (produto.variacoes?.length)
            embed.addFields({ name: '🎛️ Variações', value: produto.variacoes.join('\n') });
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ---------------------------------------------------
    //   BOTÃO: comprar_<id>
    // ---------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith('comprar_')) {
        const produtoId = interaction.customId.replace('comprar_', '');
        const produto   = produtos[produtoId];
        if (!produto)
            return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });

        if ((estoque[produtoId] || []).length === 0)
            return interaction.reply({ content: '❌ Este produto está sem estoque no momento.', ephemeral: true });

        const state = painelState[interaction.user.id] || {};
        let variacaoTexto = null;
        if (Array.isArray(produto.variacoes) && produto.variacoes.length > 1) {
            if (state.produtoIdCompra !== produtoId || state.variacaoIdx === undefined)
                return interaction.reply({ content: '⚠️ Selecione uma variação no menu acima antes de comprar!', ephemeral: true });
            variacaoTexto = produto.variacoes[parseInt(state.variacaoIdx)];
        } else if (Array.isArray(produto.variacoes) && produto.variacoes.length === 1) {
            variacaoTexto = produto.variacoes[0];
        }

        await interaction.deferReply({ ephemeral: true });

        const guild     = interaction.guild;
        const nomeCanal = `compra-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        const existente = guild.channels.cache.find(c => c.name === nomeCanal && tickets[c.id]);
        if (existente)
            return interaction.editReply(`❌ Você já tem um ticket aberto: ${existente}`);

        const canal = await guild.channels.create({
            name: nomeCanal,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id,            deny:  [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: client.user.id,      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                ...(config.cargo_staff ? [{ id: config.cargo_staff, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : [])
            ]
        });

        tickets[canal.id] = {
            produtoId,
            variacao:  variacaoTexto,
            userId:    interaction.user.id,
            entregue:  false,
            avaliou:   false
        };

        if (painelState[interaction.user.id]) {
            delete painelState[interaction.user.id].variacaoIdx;
            delete painelState[interaction.user.id].produtoIdCompra;
        }

        const embedTicket = new EmbedBuilder()
            .setTitle('🛒 Pedido de Compra — ZStore')
            .setDescription(`Olá ${interaction.user}! Realize o pagamento via **PIX** e clique em **✅ Confirmar PIX**.`)
            .addFields(
                { name: '📦 Produto', value: produto.nome,          inline: true },
                { name: '💰 Valor',   value: `R$ ${produto.preco}`, inline: true },
                ...(variacaoTexto ? [{ name: '🎛️ Variação', value: variacaoTexto, inline: true }] : []),
                { name: '💳 Chave PIX', value: `\`\`\`${config.chave_pix}\`\`\`` },
                { name: '⚠️ Importante', value: '> Após pagar clique em **✅ Confirmar PIX**.\n> Não chame membros da equipe no privado.' }
            )
            .setColor('Yellow')
            .setFooter({ text: 'ZStore • Pagamento PIX' });
        if (produto.imagem) embedTicket.setThumbnail(produto.imagem);

        await canal.send({
            content: `${interaction.user}`,
            embeds:  [embedTicket],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`confirmar_pix_${canal.id}`).setLabel('✅ Confirmar PIX').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`fechar_ticket_${canal.id}`).setLabel('🔒 Fechar Ticket').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`cancelar_ticket_${canal.id}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
            )]
        });

        await interaction.editReply(`✅ Ticket criado! Acesse: ${canal}`);

        // Log no canal de logs-tickets
        const canalLogs = resolverCanal(guild, config.canal_logs, 'logs-tickets');
        if (canalLogs) {
            const embedLog = new EmbedBuilder()
                .setTitle('📞 Novo Ticket Criado — ZStore')
                .addFields(
                    { name: '👤 Comprador', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📦 Produto',   value: produto.nome,                inline: true },
                    { name: '💰 Valor',     value: `R$ ${produto.preco}`,       inline: true },
                    ...(variacaoTexto ? [{ name: '🎛️ Variação', value: variacaoTexto, inline: true }] : []),
                    { name: '🎫 Ticket',   value: `${canal}` }
                )
                .setColor('Blue')
                .setTimestamp()
                .setFooter({ text: 'ZStore • Logs de Tickets' });
            await canalLogs.send({ content: `<@${interaction.user.id}>`, embeds: [embedLog] })
                .catch(e => console.error('[ERRO logs]', e.message));
        }
        return;
    }

    // ---------------------------------------------------
    //   BOTÃO: confirmar_pix_<canalId>
    // ---------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith('confirmar_pix_')) {
        const canalId = interaction.customId.replace('confirmar_pix_', '');
        const dados   = tickets[canalId];
        if (!dados)
            return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
        if (interaction.user.id !== dados.userId)
            return interaction.reply({ content: '❌ Apenas o dono do ticket pode confirmar.', ephemeral: true });

        await interaction.reply({ content: '⏳ PIX enviado para análise! Aguarde a confirmação da equipe...', ephemeral: true });

        await interaction.message.edit({
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`confirmar_pix_${canalId}`).setLabel('⏳ Aguardando confirmação...').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId(`fechar_ticket_${canalId}`).setLabel('🔒 Fechar Ticket').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`cancelar_ticket_${canalId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger).setDisabled(true)
            )]
        }).catch(() => {});

        const produto = produtos[dados.produtoId];
        const usuario = await interaction.guild.members.fetch(dados.userId).catch(() => null);

        const canalPix = resolverCanal(interaction.guild, null, 'confirmar-pix');
        if (!canalPix)
            return interaction.followUp({ content: '❌ Canal `confirmar-pix` não encontrado!', ephemeral: true });

        const embedPix = new EmbedBuilder()
            .setTitle('💳 Novo PIX para Confirmar — ZStore')
            .addFields(
                { name: '👤 Comprador', value: usuario ? `${usuario}` : `<@${dados.userId}>`, inline: true },
                { name: '📦 Produto',   value: produto?.nome  || '?',                         inline: true },
                { name: '💰 Valor',     value: `R$ ${produto?.preco || '?'}`,                 inline: true },
                ...(dados.variacao ? [{ name: '🎛️ Variação', value: dados.variacao, inline: true }] : []),
                { name: '🎫 Ticket',   value: `<#${canalId}>` }
            )
            .setColor('Orange')
            .setTimestamp();
        if (produto?.imagem) embedPix.setThumbnail(produto.imagem);

        await canalPix.send({
            embeds: [embedPix],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`pix_ok_${canalId}`).setLabel('✅ PIX Confirmado').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`pix_nao_${canalId}`).setLabel('❌ PIX Não Confirmado').setStyle(ButtonStyle.Danger)
            )]
        });
        return;
    }

    // ---------------------------------------------------
    //   BOTÃO: pix_ok_<canalId>
    // ---------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith('pix_ok_')) {
        if (!isStaff(interaction.member))
            return interaction.reply({ content: '❌ Apenas Staff.', ephemeral: true });

        const canalId = interaction.customId.replace('pix_ok_', '');
        const dados   = tickets[canalId];
        if (!dados)
            return interaction.reply({ content: '❌ Ticket não encontrado ou já processado.', ephemeral: true });

        const itens = estoque[dados.produtoId] || [];
        if (itens.length === 0)
            return interaction.reply({ content: '❌ Sem estoque! Use `!adicionarestoque`.', ephemeral: true });

        const item = itens.shift();
        estoque[dados.produtoId] = itens;
        loja.salvarEstoque(guildId, estoque);
        dados.entregue = true;

        await interaction.update({ components: [] });

        // Dá cargo de cliente
        if (config.cargo_cliente) {
            const membro = await interaction.guild.members.fetch(dados.userId).catch(() => null);
            if (membro) await membro.roles.add(config.cargo_cliente).catch(e => console.error('[ERRO cargo_cliente]', e.message));
        }

        const produto    = produtos[dados.produtoId];
        const ticketCanal = interaction.guild.channels.cache.get(canalId);

        if (ticketCanal) {
            const embedEntrega = new EmbedBuilder()
                .setTitle('✅ Produto Entregue! — ZStore')
                .setDescription(`<@${dados.userId}>, sua compra foi confirmada!`)
                .addFields(
                    { name: '📦 Produto', value: produto?.nome || '?' },
                    ...(dados.variacao ? [{ name: '🎛️ Variação', value: dados.variacao }] : []),
                    { name: '🎁 Seu Item', value: `\`\`\`${item}\`\`\`` }
                )
                .setColor('Green')
                .setFooter({ text: 'ZStore • Agradecemos a preferência!' })
                .setTimestamp();
            if (produto?.imagem) embedEntrega.setThumbnail(produto.imagem);

            await ticketCanal.send({
                content: `<@${dados.userId}>`,
                embeds:  [embedEntrega],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`fechar_ticket_${canalId}`).setLabel('🔒 Fechar Ticket').setStyle(ButtonStyle.Secondary)
                )]
            });
        }

        // Notifica canal de vendas
        const canalVendas = resolverCanal(interaction.guild, config.canal_vendas, 'vendas');
        if (canalVendas) {
            const embedVenda = new EmbedBuilder()
                .setTitle('💵 Nova Venda Realizada! — ZStore')
                .addFields(
                    { name: '👤 Comprador', value: `<@${dados.userId}>`,          inline: true },
                    { name: '📦 Produto',   value: produto?.nome  || '?',         inline: true },
                    { name: '💰 Valor',     value: `R$ ${produto?.preco || '?'}`, inline: true },
                    ...(dados.variacao ? [{ name: '🎛️ Variação', value: dados.variacao, inline: true }] : [])
                )
                .setColor('Green')
                .setTimestamp()
                .setFooter({ text: 'ZStore • Controle de Vendas' });
            if (produto?.imagem) embedVenda.setThumbnail(produto.imagem);
            await canalVendas.send({ embeds: [embedVenda] })
                .catch(e => console.error('[ERRO canal vendas]', e.message));
        }
        return;
    }

    // ---------------------------------------------------
    //   BOTÃO: pix_nao_<canalId>
    // ---------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith('pix_nao_')) {
        if (!isStaff(interaction.member))
            return interaction.reply({ content: '❌ Apenas Staff.', ephemeral: true });

        const canalId = interaction.customId.replace('pix_nao_', '');
        await interaction.update({ components: [] });

        const canal = interaction.guild.channels.cache.get(canalId);
        if (canal)
            await canal.send(`<@${tickets[canalId]?.userId}> ❌ **Pagamento não confirmado.** Verifique o valor e tente novamente.`);
        return;
    }

    // ---------------------------------------------------
    //   BOTÃO: cancelar_ticket_<canalId>
    // ---------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith('cancelar_ticket_')) {
        const dados      = tickets[interaction.channel.id];
        const podeFechar = isStaff(interaction.member) || interaction.user.id === dados?.userId;
        if (!podeFechar)
            return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

        await interaction.reply('🔒 Cancelando ticket em 3 segundos...');
        delete tickets[interaction.channel.id];
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        return;
    }

    // ---------------------------------------------------
    //   BOTÃO: fechar_ticket_<canalId>
    //   → Produto entregue + não avaliou → abre modal
    //   → Caso contrário → fecha direto
    // ---------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith('fechar_ticket_')) {
        const dados      = tickets[interaction.channel.id];
        const podeFechar = isStaff(interaction.member) || interaction.user.id === dados?.userId;

        if (!podeFechar)
            return interaction.reply({ content: '❌ Sem permissão para fechar este ticket.', ephemeral: true });

        if (dados && dados.entregue && !dados.avaliou && interaction.user.id === dados.userId)
            return interaction.showModal(buildAvaliacaoModal(interaction.channel.id));

        await interaction.reply('🔒 Ticket sendo fechado em 5 segundos...');
        delete tickets[interaction.channel.id];
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        return;
    }

    // ---------------------------------------------------
    //   MODAL: avaliacao_modal_<canalId>
    // ---------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId.startsWith('avaliacao_modal_')) {
        const canalId = interaction.customId.replace('avaliacao_modal_', '');
        const dados   = tickets[canalId] || tickets[interaction.channel.id];

        const notaRaw = interaction.fields.getTextInputValue('nota').trim();
        const nota    = parseInt(notaRaw);

        if (isNaN(nota) || nota < 1 || nota > 5)
            return interaction.reply({ content: '❌ Nota inválida. Digite um número entre **1** e **5**.', ephemeral: true });

        const comentario = interaction.fields.getTextInputValue('comentario').trim();
        const estrelas   = '⭐'.repeat(nota);

        if (dados) dados.avaliou = true;

        await interaction.reply({ content: '✅ Avaliação enviada com sucesso! O ticket será fechado em 5 segundos.', ephemeral: true });

        const nomeProduto = dados?.produtoId
            ? (produtos[dados.produtoId]?.nome || 'Desconhecido')
            : 'Desconhecido';

        const embedFeed = new EmbedBuilder()
            .setTitle('💖 Nova Avaliação — ZStore')
            .setDescription(`> ${comentario}`)
            .addFields(
                { name: '👤 Cliente', value: `<@${interaction.user.id}>`, inline: true },
                { name: '⭐ Nota',    value: estrelas,                    inline: true },
                { name: '📦 Produto', value: nomeProduto,                 inline: true }
            )
            .setColor('Pink')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: 'ZStore • Sistema de Avaliação' });

        const canalFeedback = resolverCanal(interaction.guild, config.canal_feedbacks, 'feedbacks');
        if (canalFeedback) {
            await canalFeedback.send({ content: `<@${interaction.user.id}>`, embeds: [embedFeed] })
                .catch(e => console.error('[ERRO feedbacks]', e.message));
        } else {
            console.warn('[AVISO] Canal de feedbacks não configurado. Use !setfeedbacks #canal');
        }

        delete tickets[interaction.channel.id];
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        return;
    }

    } catch (err) {
        console.error('[ERRO interação]', err);
        try {
            if (!interaction.replied && !interaction.deferred)
                await interaction.reply({ content: '❌ Ocorreu um erro inesperado. Tente novamente.', ephemeral: true });
        } catch (_) {}
    }
});

// =====================================================
//   LOGIN
// =====================================================
client.login(process.env.TOKEN);
