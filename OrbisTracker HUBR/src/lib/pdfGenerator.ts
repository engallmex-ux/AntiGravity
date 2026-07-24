import { jsPDF } from 'jspdf';
import { InspectionRecord, LabelImage } from '../types';

// Helper to load an external image (e.g. QR code) as HTMLImageElement
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Falha ao carregar QR code do ativo.'));
    img.src = url;
  });
}

// Helper to format/validate base64 data URLs
function getBase64DataUrl(base64: string, mimeType: string = 'image/jpeg'): string {
  if (base64.startsWith('data:')) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
}

// Translate labelTypes to friendly PT-BR text
function getLabelTypeText(type: string): string {
  switch (type) {
    case 'serie': return 'Número de Série';
    case 'patrimonio': return 'Plaqueta de Patrimônio';
    case 'tecnica': return 'Etiqueta Técnica do Fabricante';
    case 'calibracao': return 'Etiqueta de Calibração';
    case 'manutencao': return 'Etiqueta de Manutenção';
    case 'seguranca': return 'Selo de Segurança Elétrica';
    case 'geral': return 'Geral / Equipamento Completo';
    default: return 'Evidência Fotográfica';
  }
}

export async function generateInspectionPDF(rec: InspectionRecord): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2); // 180mm
  let currentY = 15;

  // Colors
  const primaryColor = [16, 185, 129]; // Emerald (#10b981)
  const secondaryColor = [15, 23, 42]; // Slate-900 (#0f172a)
  const lightBgColor = [248, 250, 252]; // Slate-50 (#f8fafc)
  const borderColor = [226, 232, 240]; // Slate-200 (#e2e8f0)
  const textMainColor = [51, 65, 85]; // Slate-700
  const textLightColor = [100, 116, 139]; // Slate-500

  // 1. Top Aesthetic Header Bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Orbis logo placeholder / branding text
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('ORBISTRACKER HU-BR', margin, 18);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(textLightColor[0], textLightColor[1], textLightColor[2]);
  doc.text('Engenharia Clínica & Gestão de Ativos de Saúde', margin, 23);

  // Date and Auditor
  const dateStr = new Date(rec.timestamp).toLocaleDateString('pt-BR');
  const timeStr = new Date(rec.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`Data: ${dateStr} - ${timeStr}`, pageWidth - margin, 18, { align: 'right' });
  
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(textLightColor[0], textLightColor[1], textLightColor[2]);
  const auditorText = rec.auditorNome 
    ? (rec.auditorRE ? `${rec.auditorNome} (RE-${rec.auditorRE})` : rec.auditorNome)
    : 'Técnico Local';
  doc.text(`Auditor: ${auditorText}`, pageWidth - margin, 23, { align: 'right' });

  // Divider
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, 26, pageWidth - margin, 26);
  
  currentY = 32;

  // 2. Title Card
  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(margin, currentY, contentWidth, 16, 2, 2, 'FD');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('RELATÓRIO DE INSPEÇÃO TÉCNICA E CADASTRO', margin + 5, currentY + 10);
  
  const codAtivo = rec.ativoCodigo || 'EQP-REGISTRO';
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(codAtivo, pageWidth - margin - 5, currentY + 10, { align: 'right' });
  
  if (rec.isTrainingItem) {
    currentY += 20;
    doc.setFillColor(238, 242, 255); // indigo-50
    doc.setDrawColor(199, 210, 254); // indigo-200
    doc.roundedRect(margin, currentY, contentWidth, 14, 2, 2, 'FD');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(67, 56, 202); // indigo-700
    doc.text('AVISO LEGAL: ATIVO DE TREINAMENTO OU USO GERAL (NÃO-MÉDICO)', margin + 5, currentY + 5.5);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text('Este equipamento NÃO se enquadra como dispositivo médico regulamentado. Uso didático ou de simulação.', margin + 5, currentY + 10);
    
    currentY += 18;
  } else {
    currentY += 22;
  }

  // 3. Technical Specifications + QR Code Block
  // We'll prepare specifications left-aligned, and the QR Code box right-aligned
  const specs = [
    { label: 'Nome do Equipamento', value: rec.equipamento },
    { label: 'Código do Ativo (ID)', value: rec.ativoCodigo || 'N/A' },
    { label: 'Fabricante / Marca', value: rec.fabricante },
    { label: 'Modelo Técnico', value: rec.modelo },
    { label: 'Nº de Série (S/N)', value: rec.numSerie },
    { label: 'Nº de Patrimônio (Plaqueta)', value: rec.numPatrimonio || 'N/A' },
    { label: 'Setor de Localização', value: rec.setor || 'Geral' },
    { label: 'Condição de Funcionamento', value: rec.condicao || 'N/A' },
    { label: 'Regime de Propriedade', value: rec.propriedade || 'Próprio' },
    { label: 'Equipamento Recém-Chegado', value: rec.isNewEquipment ? 'SIM' : 'NÃO' },
    { label: 'Manual de Instruções', value: rec.linkManual || 'NÃO ENCONTRADO / NÃO ANEXADO' },
    { label: 'Nº O.S. (Sistema GETS)', value: rec.numeroOSGets || 'N/D' },
    { label: 'Coordenadas Satélite (GPS)', value: rec.latitude && rec.longitude ? `${rec.latitude.toFixed(6)}, ${rec.longitude.toFixed(6)}` : 'Não registrado' }
  ];

  const leftWidth = 115;
  const rightBoxX = 140;
  const rightBoxWidth = 55;
  const rightBoxHeight = 78; // Increased slightly to match 13 rows height (13 * 6 = 78)

  // Draw tag replica background and slate outline for physical look
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(30, 41, 59); // Slate-800
  doc.setLineWidth(0.4);
  doc.roundedRect(rightBoxX, currentY, rightBoxWidth, rightBoxHeight, 1.5, 1.5, 'FD');

  // Tag title/header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(0, 0, 0);
  doc.text('HOSPITAL UNIVERSITÁRIO - HU', rightBoxX + rightBoxWidth / 2, currentY + 4, { align: 'center' });
  
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);
  doc.line(rightBoxX, currentY + 5.5, rightBoxX + rightBoxWidth, currentY + 5.5);

  // Load and inject dynamic QR code pointing to Google Drive Asset folder
  const driveUrl = rec.driveFolderUrl || (rec.googleDriveLinks && rec.googleDriveLinks[0]) || `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(rec.ativoCodigo || rec.numSerie || rec.equipamento)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(driveUrl)}`;

  try {
    const qrImg = await loadImage(qrCodeUrl);
    // Draw the QR Code perfectly centered in upper middle of sticker
    doc.addImage(qrImg, 'PNG', rightBoxX + 16.5, currentY + 7.5, 22, 22);
  } catch (err) {
    doc.setFontSize(5);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('ERRO QR CODE (OFFLINE)', rightBoxX + rightBoxWidth / 2, currentY + 18, { align: 'center' });
  }

  // Draw Asset Code in bold inverse colored banner (black rect + white text)
  const bannerY = currentY + 31.5;
  const bannerH = 5.2;
  doc.setFillColor(0, 0, 0);
  doc.rect(rightBoxX + 3, bannerY, rightBoxWidth - 6, bannerH, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text(String(rec.ativoCodigo || 'ATIVO').toUpperCase(), rightBoxX + rightBoxWidth / 2, bannerY + 3.8, { align: 'center' });

  // Draw label fields
  doc.setTextColor(0, 0, 0);
  let stickerTextY = currentY + 41.5;

  const stickerFields = [
    { label: 'EQ', value: rec.equipamento },
    { label: 'MOD', value: `${rec.fabricante || 'N/A'} / ${rec.modelo || 'N/A'}` },
    { label: 'SET', value: rec.setor || 'Geral' },
    { label: 'S/N', value: rec.numSerie || 'N/D' }
  ];

  stickerFields.forEach((field) => {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(5);
    doc.text(`${field.label}:`, rightBoxX + 4, stickerTextY);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(4.8);
    const val = String(field.value || 'N/D').toUpperCase();
    const truncatedVal = val.length > 32 ? val.substring(0, 29) + '...' : val;
    doc.text(truncatedVal, rightBoxX + 11, stickerTextY);
    stickerTextY += 4;
  });

  // Small divider
  doc.setLineWidth(0.2);
  doc.setDrawColor(120, 120, 120);
  doc.line(rightBoxX + 3, stickerTextY, rightBoxX + rightBoxWidth - 3, stickerTextY);
  stickerTextY += 3.5;

  // Auditor name + RE and date
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(4.2);
  const auditorNamePart = (rec.auditorNome || 'TECNICO').toUpperCase();
  const auditorRePart = rec.auditorRE ? `RE-${rec.auditorRE}` : 'ENG. CLINICA';
  const formattedDate = new Date(rec.timestamp).toLocaleDateString('pt-BR');
  doc.text(`AUD: ${auditorNamePart} (${auditorRePart}) - ${formattedDate}`, rightBoxX + 4, stickerTextY);

  // Sticker Footer branding
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(60, 60, 60);
  doc.text('ORBIS ENGENHARIA CLÍNICA E HOSPITALAR', rightBoxX + rightBoxWidth / 2, currentY + 75.5, { align: 'center' });

  // Reset document standard drawing styles
  doc.setTextColor(textMainColor[0], textMainColor[1], textMainColor[2]);

  // Draw technical specs rows on the left side
  let specY = currentY;
  doc.setFontSize(8.5);
  specs.forEach((spec, idx) => {
    // Alternating bg color
    if (idx % 2 === 0) {
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.rect(margin, specY, leftWidth, 6, 'F');
    }
    
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(spec.label + ':', margin + 3, specY + 4.5);
    
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(textMainColor[0], textMainColor[1], textMainColor[2]);
    
    // Truncate value if too long to prevent overflowing leftWidth
    const rawVal = String(spec.value || 'N/A').toUpperCase();
    const cleanVal = rawVal.length > 32 ? rawVal.substring(0, 30) + '...' : rawVal;
    doc.text(cleanVal, margin + 46, specY + 4.5);
    
    specY += 6;
  });

  currentY = Math.max(specY, currentY + rightBoxHeight) + 8;

  // 4. Maintenance / Calibration Checks Section
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('CONTROLE METROLÓGICO E MANUTENÇÕES', margin, currentY);

  // Accent Line
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

  const checkHeaderY = currentY + 5;
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(margin, checkHeaderY, contentWidth, 6.5, 'F');

  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Inspeção / Ensaio Realizado', margin + 3, checkHeaderY + 4.5);
  doc.text('Status', margin + 50, checkHeaderY + 4.5);
  doc.text('Técnico Responsável', margin + 70, checkHeaderY + 4.5);
  doc.text('Data Realizada', margin + 120, checkHeaderY + 4.5);
  doc.text('Próx. Validade', margin + 150, checkHeaderY + 4.5);

  let checkRowY = checkHeaderY + 6.5;
  doc.setFontSize(7.5);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(textMainColor[0], textMainColor[1], textMainColor[2]);

  // Row 1: Calibração
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, checkRowY, contentWidth, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('Calibração Periódica', margin + 3, checkRowY + 4.5);
  doc.setFont('Helvetica', 'normal');
  doc.text(rec.temCalibracao ? 'CONCLUÍDO' : 'NÃO POSSUI', margin + 50, checkRowY + 4.5);
  doc.text(rec.executadoPorCal || 'N/A', margin + 70, checkRowY + 4.5);
  doc.text(rec.dataCal || 'N/D', margin + 120, checkRowY + 4.5);
  doc.setFont('Helvetica', 'bold');
  const calColor = rec.temCalibracao ? [5, 150, 105] : [220, 38, 38];
  doc.setTextColor(calColor[0], calColor[1], calColor[2]);
  doc.text(rec.proxCal || 'PENDENTE', margin + 150, checkRowY + 4.5);
  doc.setTextColor(textMainColor[0], textMainColor[1], textMainColor[2]);

  // Row 2: Preventiva
  checkRowY += 7;
  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.rect(margin, checkRowY, contentWidth, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('Manutenção Preventiva', margin + 3, checkRowY + 4.5);
  doc.setFont('Helvetica', 'normal');
  doc.text(rec.temManutencao ? 'CONCLUÍDO' : 'NÃO POSSUI', margin + 50, checkRowY + 4.5);
  doc.text(rec.executadoPorManut || 'N/A', margin + 70, checkRowY + 4.5);
  doc.text(rec.dataManut || 'N/D', margin + 120, checkRowY + 4.5);
  doc.setFont('Helvetica', 'bold');
  const maintColor = rec.temManutencao ? [5, 150, 105] : [220, 38, 38];
  doc.setTextColor(maintColor[0], maintColor[1], maintColor[2]);
  doc.text(rec.proxManut || 'PENDENTE', margin + 150, checkRowY + 4.5);
  doc.setTextColor(textMainColor[0], textMainColor[1], textMainColor[2]);

  // Row 3: Segurança Elétrica
  checkRowY += 7;
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, checkRowY, contentWidth, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('Segurança Elétrica (60601)', margin + 3, checkRowY + 4.5);
  doc.setFont('Helvetica', 'normal');
  doc.text(rec.temSegurancaEletrica ? 'CONCLUÍDO' : 'NÃO POSSUI', margin + 50, checkRowY + 4.5);
  doc.text(rec.executadoPorSegElet || 'N/A', margin + 70, checkRowY + 4.5);
  doc.text(rec.dataSegElet || 'N/D', margin + 120, checkRowY + 4.5);
  doc.setFont('Helvetica', 'bold');
  const safeColor = rec.temSegurancaEletrica ? [5, 150, 105] : [220, 38, 38];
  doc.setTextColor(safeColor[0], safeColor[1], safeColor[2]);
  doc.text(rec.proxSegElet || 'PENDENTE', margin + 150, checkRowY + 4.5);
  doc.setTextColor(textMainColor[0], textMainColor[1], textMainColor[2]);

  // Border of table
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, checkHeaderY, contentWidth, checkRowY + 7 - checkHeaderY);

  currentY = checkRowY + 14;

  // 5. Linked Accessories Section (Optional)
  if (rec.accessories && rec.accessories.length > 0) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('ACESSÓRIOS E CONSUMÍVEIS VINCULADOS', margin, currentY);

    // Accent Line
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.6);
    doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

    let accY = currentY + 5;
    doc.setFontSize(7.5);
    rec.accessories.forEach((acc, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
        doc.rect(margin, accY, contentWidth, 6, 'F');
      }
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      const accCode = acc.codigoAcessorio || `ACC-${idx+1}`;
      doc.text(`[${accCode}] ${acc.tipo.toUpperCase()}`, margin + 3, accY + 4.2);

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(textMainColor[0], textMainColor[1], textMainColor[2]);
      doc.text(`${acc.descricao.toUpperCase()} ${acc.numSerie ? `(S/N: ${acc.numSerie})` : ''}`, margin + 55, accY + 4.2);

      accY += 6;
    });

    // Outer border
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.rect(margin, currentY + 5, contentWidth, accY - (currentY + 5));

    currentY = accY + 8;
  }

  // 6. Observations / Notes Section
  if (rec.observacoes && rec.observacoes.trim()) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('OBSERVAÇÕES TÉCNICAS E PARECER', margin, currentY);

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.6);
    doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(textMainColor[0], textMainColor[1], textMainColor[2]);
    
    const wrappedNotes = doc.splitTextToSize(rec.observacoes, contentWidth - 6);
    const boxHeight = (wrappedNotes.length * 4.2) + 6;
    
    doc.setFillColor(253, 253, 253);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.roundedRect(margin, currentY + 5, contentWidth, boxHeight, 1.5, 1.5, 'FD');
    
    doc.text(wrappedNotes, margin + 3, currentY + 10);
    currentY += boxHeight + 12;
  } else {
    currentY += 8;
  }

  // 7. Footer Audit / Signature Box (placed on bottom of page 1 dynamically or on a new page if no space)
  const requiredFooterSpace = 25;
  if (currentY + requiredFooterSpace > pageHeight) {
    doc.addPage();
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 5, 'F');
    currentY = 20;
  } else {
    currentY = pageHeight - 35;
  }

  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.4);
  doc.line(margin + 20, currentY + 15, pageWidth - margin - 20, currentY + 15);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textLightColor[0], textLightColor[1], textLightColor[2]);
  doc.text('Assinatura do Técnico Auditor Autorizado', pageWidth / 2, currentY + 19, { align: 'center' });
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('LAUDO TÉCNICO EMITIDO VIA SISTEMA DE TELEMETRIA ORBISTRACKER CLINICAL', pageWidth / 2, currentY + 24, { align: 'center' });

  // 8. Photographic Evidence Page (Page 2+ if there are active label images)
  if (rec.images && rec.images.length > 0) {
    doc.addPage();
    
    // Top bar Page 2
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 5, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('ANEXO - EVIDÊNCIAS FOTOGRÁFICAS', margin, 18);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textLightColor[0], textLightColor[1], textLightColor[2]);
    doc.text(`Registro fotográfico coletado via OCR durante a auditoria de campo.`, margin, 23);

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.line(margin, 26, pageWidth - margin, 26);
    
    let imgY = 32;

    // We render up to 4 images per page in a elegant 2x2 grid
    for (let idx = 0; idx < rec.images.length; idx++) {
      const img = rec.images[idx];
      // Calculate local index on the current page (max 4 per page)
      const pageIndex = idx % 4;
      const col = pageIndex % 2;
      const row = Math.floor(pageIndex / 2);
      
      const cellWidth = 84;
      const cellHeight = 62;
      const spacingX = col * 90; // Width + 6mm gap
      const spacingY = row * 80; // Height + 18mm gap (label space)
      
      // If we are at index 4, 8, etc., we need to spawn a new page
      if (idx > 0 && idx % 4 === 0) {
        doc.addPage();
        
        // Header on new image page
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 5, 'F');
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('ANEXO - EVIDÊNCIAS FOTOGRÁFICAS (CONT.)', margin, 18);
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.line(margin, 26, pageWidth - margin, 26);
        
        imgY = 32;
      }

      const xPos = margin + spacingX;
      const yPos = imgY + spacingY;

      // Outer image cell container
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(xPos, yPos, cellWidth, cellHeight, 1.5, 1.5, 'D');

      try {
        let imageToRender: HTMLImageElement | string;
        if (img.base64 && img.base64.trim()) {
          imageToRender = getBase64DataUrl(img.base64, img.mimeType);
        } else if (img.url) {
          // It's a saved file on the server, load it asynchronously via loadImage
          imageToRender = await loadImage(img.url);
        } else {
          throw new Error('Sem dados de imagem');
        }
        
        // Dynamically compute dimensions or fallback to 4:3
        const originalWidth = img.width || 4;
        const originalHeight = img.height || 3;
        
        const maxDrawW = cellWidth - 3; // 81mm
        const maxDrawH = cellHeight - 3; // 59mm
        const imgRatio = originalWidth / originalHeight;
        const boxRatio = maxDrawW / maxDrawH;

        let drawW = maxDrawW;
        let drawH = maxDrawH;

        if (imgRatio > boxRatio) {
          // Image is wider than bounding box aspect ratio
          drawW = maxDrawW;
          drawH = maxDrawW / imgRatio;
        } else {
          // Image is taller than bounding box aspect ratio
          drawH = maxDrawH;
          drawW = maxDrawH * imgRatio;
        }

        // Center inside the 81x59 box
        const offsetX = (maxDrawW - drawW) / 2;
        const offsetY = (maxDrawH - drawH) / 2;

        doc.addImage(imageToRender as any, 'JPEG', xPos + 1.5 + offsetX, yPos + 1.5 + offsetY, drawW, drawH);
      } catch (e) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Erro ao carregar foto do ativo', xPos + 10, yPos + 30);
      }

      // Title & category label for this image
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(`Foto ${idx + 1}: ${getLabelTypeText(img.labelType)}`, xPos, yPos + cellHeight + 4);
      
      // Dynamic details label for relevant metadata mapping
      let detailsLabel = '';
      if (img.labelType === 'serie') {
        detailsLabel = `Ativo S/N: ${rec.numSerie || 'N/D'}`;
      } else if (img.labelType === 'patrimonio') {
        detailsLabel = `Ativo Patr: ${rec.numPatrimonio || 'N/D'}`;
      } else if (img.labelType === 'calibracao') {
        detailsLabel = `Próxima Calibr: ${rec.proxCal || 'N/D'}`;
      } else if (img.labelType === 'manutencao') {
        detailsLabel = `Próxima Preventiva: ${rec.proxManut || 'N/D'}`;
      } else if (img.labelType === 'seguranca') {
        detailsLabel = `Próxima Seg. Elét: ${rec.proxSegElet || 'N/D'}`;
      } else if (img.labelType === 'geral') {
        detailsLabel = `Ativo: ${rec.ativoCodigo || 'N/D'} (${rec.equipamento})`;
      } else if (img.labelType === 'tecnica') {
        detailsLabel = `Modelo: ${rec.modelo || 'N/D'} / Fabricante: ${rec.fabricante || 'N/D'}`;
      }

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(textLightColor[0], textLightColor[1], textLightColor[2]);
      if (detailsLabel) {
        const cleanDetails = detailsLabel.length > 40 ? detailsLabel.substring(0, 37) + '...' : detailsLabel;
        doc.text(cleanDetails.toUpperCase(), xPos, yPos + cellHeight + 8);
        
        // Push file name down slightly
        const cleanFileName = img.fileName.length > 35 ? img.fileName.substring(0, 32) + '...' : img.fileName;
        doc.text(`Arq: ${cleanFileName}`, xPos, yPos + cellHeight + 11);
      } else {
        const cleanFileName = img.fileName.length > 35 ? img.fileName.substring(0, 32) + '...' : img.fileName;
        doc.text(`Arq: ${cleanFileName}`, xPos, yPos + cellHeight + 8);
      }
    }
  }

  // Trigger Save/Download of PDF with safe file name
  const safeFileName = `Relatorio_Inspecao_${(rec.ativoCodigo || 'ATV').replace(/[\/\\?%*:|"<>]/g, '_')}_${new Date(rec.timestamp).toISOString().split('T')[0]}.pdf`;
  doc.save(safeFileName);
}
