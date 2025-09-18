class HuffmanNode {
            constructor(char, freq, left = null, right = null) { this.char = char; this.freq = freq; this.left = left; this.right = right; }
            isLeaf() { return !this.left && !this.right; }
        }

        class HuffmanCompressor {
            constructor() {
                this.root = null;
                this.codes = new Map();
                this.frequencies = new Map();
                this.initializeEventListeners();
            }

            initializeEventListeners() {
                document.getElementById('showFileUploadBtn').addEventListener('click', () => {
                    const section = document.getElementById('file-upload-section');
                    const isHidden = section.style.display === 'none' || section.style.display === '';
                    section.style.display = isHidden ? 'block' : 'none';
                });

                this.setupFileDropZone('fileDropZone', 'fileInput');
                this.setupFileDropZone('decompressDropZone', 'decompressInput');
                
                document.getElementById('compressTextBtn').addEventListener('click', () => this.compressText());
                document.getElementById('compressFileBtn').addEventListener('click', () => this.compressFile());
                document.getElementById('decompressBtn').addEventListener('click', () => this.decompressFile());
                
                document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));
                document.getElementById('decompressInput').addEventListener('change', (e) => this.handleDecompressFileSelect(e));
                
                document.getElementById('inputText').addEventListener('input', (e) => {
                    document.getElementById('compressTextBtn').disabled = e.target.value.trim().length === 0;
                });
            }

            setupFileDropZone(dropZoneId, inputId) {
                const dropZone = document.getElementById(dropZoneId);
                const fileInput = document.getElementById(inputId);
                if (!dropZone || !fileInput) return;
                dropZone.addEventListener('click', () => fileInput.click());
                dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
                dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
                dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('dragover');
                    if (e.dataTransfer.files.length > 0) {
                        fileInput.files = e.dataTransfer.files;
                        fileInput.dispatchEvent(new Event('change'));
                    }
                });
            }

            handleFileSelect(e) {
                const file = e.target.files[0];
                const btn = document.getElementById('compressFileBtn');
                const info = document.getElementById('fileInfo');
                if (!file) {
                    btn.disabled = true;
                    info.innerHTML = '';
                    return;
                }
                btn.disabled = false;
                info.innerHTML = `<div class="file-info"><strong>File:</strong> ${file.name}<br><strong>Size:</strong> ${this.formatBytes(file.size)}</div>`;
            }

            handleDecompressFileSelect(e) {
                const file = e.target.files[0];
                const btn = document.getElementById('decompressBtn');
                const info = document.getElementById('decompressFileInfo');
                if (!file) {
                    btn.disabled = true;
                    info.innerHTML = '';
                    return;
                }
                btn.disabled = false;
                info.innerHTML = `<div class="file-info"><strong>File:</strong> ${file.name}<br><strong>Size:</strong> ${this.formatBytes(file.size)}</div>`;
            }

            buildFrequencyTable(data) {
                const freq = new Map();
                for (const byte of data) {
                    freq.set(byte, (freq.get(byte) || 0) + 1);
                }
                return freq;
            }

            buildHuffmanTree(frequencies) {
                const heap = Array.from(frequencies.entries()).map(([char, freq]) => new HuffmanNode(char, freq)).sort((a, b) => a.freq - b.freq);
                if (heap.length === 0) return null;
                if (heap.length === 1) return heap[0];
                while (heap.length > 1) {
                    const left = heap.shift();
                    const right = heap.shift();
                    const merged = new HuffmanNode(null, left.freq + right.freq, left, right);
                    let i = 0;
                    while (i < heap.length && heap[i].freq < merged.freq) { i++; }
                    heap.splice(i, 0, merged);
                }
                return heap[0];
            }

            generateCodes(node, code = '', codes = new Map()) {
                if (!node) return codes;
                if (node.isLeaf()) {
                    codes.set(node.char, code || '0');
                } else {
                    this.generateCodes(node.left, code + '0', codes);
                    this.generateCodes(node.right, code + '1', codes);
                }
                return codes;
            }

            encode(data, codes) {
                let result = '';
                for (const byte of data) {
                    result += codes.get(byte);
                }
                return result;
            }

            decode(bits, root) {
                if (!root) return new Uint8Array();
                if (root.isLeaf()) return new Uint8Array(bits.length).fill(root.char);
                const result = [];
                let current = root;
                for (const bit of bits) {
                    current = bit === '0' ? current.left : current.right;
                    if (!current) throw new Error("Invalid compressed data.");
                    if (current.isLeaf()) {
                        result.push(current.char);
                        current = root;
                    }
                }
                return new Uint8Array(result);
            }

            async compressText() {
                const text = document.getElementById('inputText').value;
                if (!text) return;
                try {
                    this.showLoading('compressionResult');
                    await this.delay(50);
                    const textBytes = new TextEncoder().encode(text);
                    await this.performCompression(textBytes, 'text.txt');
                } catch (error) {
                    this.showError('compressionResult', `Compression failed: ${error.message}`);
                }
            }

            async compressFile() {
                const file = document.getElementById('fileInput').files[0];
                if (!file) return;
                try {
                    this.showLoading('compressionResult');
                    const arrayBuffer = await file.arrayBuffer();
                    const fileBytes = new Uint8Array(arrayBuffer);
                    await this.performCompression(fileBytes, file.name);
                } catch (error) {
                    this.showError('compressionResult', `File compression failed: ${error.message}`);
                }
            }

            async performCompression(data, name) {
                if (data.length === 0) {
                    this.showError('compressionResult', 'Cannot compress empty data.');
                    this.updateStatistics(0, 0);
                    return;
                }
                this.frequencies = this.buildFrequencyTable(data);
                this.root = this.buildHuffmanTree(this.frequencies);
                this.codes = this.generateCodes(this.root);
                const encoded = this.encode(data, this.codes);
                this.compressedData = this.createCompressedFile(encoded, this.frequencies);
                this.updateStatistics(data.length, this.compressedData.length);
                this.displayFrequencyTable();
                this.displayHuffmanCodes();
                this.visualizeTree();
                const baseName = name.includes('.') ? name.split('.').slice(0, -1).join('.') : name;
                const compressedName = `${baseName}_compressed.huff`;
                document.getElementById('compressionResult').innerHTML = `<div class="file-info"><strong>✅ Compression Complete!</strong></div><button class="btn" onclick="huffmanCompressor.downloadCompressed('${compressedName}')">📥 Download File</button>`;
            }

            createCompressedFile(encodedBits, frequencies) {
                const freqEntries = Array.from(frequencies.entries());
                const padding = (8 - (encodedBits.length % 8)) % 8;
                const paddedBits = encodedBits + '0'.repeat(padding);
                const compressedBytes = [];
                for (let i = 0; i < paddedBits.length; i += 8) {
                    compressedBytes.push(parseInt(paddedBits.substr(i, 8), 2));
                }
                const buffer = new ArrayBuffer(8 + (freqEntries.length * 5) + compressedBytes.length);
                const view = new DataView(buffer);
                let offset = 0;
                view.setUint32(offset, freqEntries.length, true);
                offset += 4;
                for (const [char, freq] of freqEntries) {
                    view.setUint8(offset++, char);
                    view.setUint32(offset, freq, true);
                    offset += 4;
                }
                view.setUint32(offset, padding, true);
                offset += 4;
                compressedBytes.forEach(byte => view.setUint8(offset++, byte));
                return new Uint8Array(buffer);
            }

            async decompressFile() {
                const file = document.getElementById('decompressInput').files[0];
                if (!file) return;
                try {
                    this.showLoading('decompressionResult');
                    const arrayBuffer = await file.arrayBuffer();
                    const compressedData = new Uint8Array(arrayBuffer);
                    const decompressed = this.parseCompressedFile(compressedData);
                    this.decompressedData = decompressed;
                    this.decompressedName = file.name.replace('.huff', '').replace('_compressed', '');
                    document.getElementById('decompressionResult').innerHTML = `<div class="file-info"><strong>✅ Decompression Complete!</strong></div><button class="btn" onclick="huffmanCompressor.downloadDecompressed()">📥 Download File</button>`;
                } catch (error) {
                    this.showError('decompressionResult', `Decompression failed: ${error.message}`);
                }
            }

            parseCompressedFile(compressedData) {
                const view = new DataView(compressedData.buffer);
                let offset = 4;
                const tableSize = view.getUint32(0, true);
                const frequencies = new Map();
                for (let i = 0; i < tableSize; i++) {
                    const char = view.getUint8(offset++);
                    const freq = view.getUint32(offset, true);
                    offset += 4;
                    frequencies.set(char, freq);
                }
                const padding = view.getUint32(offset, true);
                offset += 4;
                const compressedBytes = compressedData.slice(offset);
                let bits = '';
                for (const byte of compressedBytes) { bits += byte.toString(2).padStart(8, '0'); }
                if (padding > 0) bits = bits.slice(0, -padding);
                this.root = this.buildHuffmanTree(frequencies);
                return this.decode(bits, this.root);
            }

            downloadCompressed(filename) {
                if (!this.compressedData) return;
                const blob = new Blob([this.compressedData], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            downloadDecompressed() {
                if (!this.decompressedData || !this.decompressedName) return;
                const blob = new Blob([this.decompressedData], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.decompressedName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            updateStatistics(original, compressed) {
                document.getElementById('originalSize').textContent = original;
                document.getElementById('compressedSize').textContent = compressed;
                if (original > 0) {
                    const ratio = ((compressed / original) * 100);
                    const saving = 100 - ratio;
                    document.getElementById('compressionRatio').textContent = `${ratio.toFixed(1)}%`;
                    document.getElementById('spaceSaving').textContent = `${saving.toFixed(1)}%`;
                } else {
                    document.getElementById('compressionRatio').textContent = '0%';
                    document.getElementById('spaceSaving').textContent = '0%';
                }
            }

            displayFrequencyTable() {
                const tableEl = document.getElementById('frequencyTable');
                const sortedFreq = Array.from(this.frequencies.entries()).sort((a, b) => b[1] - a[1]);
                if (sortedFreq.length === 0) {
                    tableEl.innerHTML = `<p style="text-align: center; opacity: 0.6;">No data to display</p>`; return;
                }
                tableEl.innerHTML = sortedFreq.map(([char, freq]) => `<div class="freq-item"><span>'${(char >= 32 && char <= 126) ? String.fromCharCode(char) : `[${char}]`}'</span><span>${freq}</span></div>`).join('');
            }

            displayHuffmanCodes() {
                const codesEl = document.getElementById('codesDisplay');
                if (this.codes.size === 0) {
                    codesEl.innerHTML = `<p style="text-align: center; opacity: 0.6;">No codes to display</p>`; return;
                }
                const sortedCodes = Array.from(this.codes.entries()).sort((a, b) => this.frequencies.get(b[0]) - this.frequencies.get(a[0]));
                codesEl.innerHTML = sortedCodes.map(([char, code]) => `<div class="freq-item"><span>'${(char >= 32 && char <= 126) ? String.fromCharCode(char) : `[${char}]`}'</span><code>${code}</code></div>`).join('');
            }

            visualizeTree() {
                const container = document.getElementById('treeContainer');
                container.innerHTML = '';
                if (!this.root) { container.innerHTML = `<p style="text-align: center; opacity: 0.6; margin-top: 100px;">Compress some data for visualization</p>`; return; }
                const { maxDepth, leafCount } = this.getTreeDimensions(this.root, 0);
                const vSpacing = 100, minHSpacing = 50;
                let hSpacing = 80;
                const availableWidth = container.clientWidth;
                if ((leafCount * hSpacing) > availableWidth) {
                    hSpacing = availableWidth / leafCount;
                }
                const totalWidth = leafCount * Math.max(hSpacing, minHSpacing);
                container.style.height = `${(maxDepth + 1) * vSpacing}px`;
                this.drawNode(this.root, container, 0, 0, totalWidth, null);
            }
            
            getTreeDimensions(node, depth) {
                if (!node) return { maxDepth: depth - 1, leafCount: 0 };
                if (node.isLeaf()) return { maxDepth: depth, leafCount: 1 };
                const left = this.getTreeDimensions(node.left, depth + 1);
                const right = this.getTreeDimensions(node.right, depth + 1);
                return {
                    maxDepth: Math.max(left.maxDepth, right.maxDepth),
                    leafCount: left.leafCount + right.leafCount
                };
            }
            
            drawNode(node, container, depth, minX, maxX, parentCenter = null) {
                if (!node) return;
                const nodeSize = 60, vSpacing = 100;
                const x = (minX + maxX) / 2;
                const y = depth * vSpacing;
                const currentCenter = { x: x, y: y + nodeSize / 2 };
                if (parentCenter) {
                    this.drawLine(container, parentCenter, currentCenter, nodeSize);
                }
                const nodeEl = document.createElement('div');
                nodeEl.className = `tree-node ${node.isLeaf() ? 'leaf' : 'internal'}`;
                if (node.isLeaf()) {
                    const char = node.char;
                    const charDisplay = (char === 32) ? "' '" : (char >= 33 && char <= 126) ? String.fromCharCode(char) : `[${char}]`;
                    nodeEl.innerHTML = `<span>${charDisplay}</span><small>${node.freq}</small>`;
                } else {
                    nodeEl.innerHTML = `<small>${node.freq}</small>`;
                }
                nodeEl.style.left = `${x - nodeSize / 2}px`;
                nodeEl.style.top = `${y}px`;
                container.appendChild(nodeEl);
                if (!node.isLeaf()) {
                    const { leafCount: leftLeaves } = this.getTreeDimensions(node.left, 0);
                    const totalLeaves = this.getTreeDimensions(node, 0).leafCount;
                    const boundary = minX + (maxX - minX) * (leftLeaves / totalLeaves);
                    this.drawNode(node.left, container, depth + 1, minX, boundary, currentCenter);
                    this.drawNode(node.right, container, depth + 1, boundary, maxX, currentCenter);
                }
            }

            drawLine(container, center1, center2, nodeSize) {
                const angle = Math.atan2(center2.y - center1.y, center2.x - center1.x);
                const radius = nodeSize / 2;
                const startX = center1.x + radius * Math.cos(angle);
                const startY = center1.y + radius * Math.sin(angle);
                const endX = center2.x - radius * Math.cos(angle);
                const endY = center2.y - radius * Math.sin(angle);
                const length = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
                const rotationAngle = angle * (180 / Math.PI);
                const lineEl = document.createElement('div');
                lineEl.className = 'tree-line';
                lineEl.style.width = `${length}px`;
                lineEl.style.left = `${startX}px`;
                lineEl.style.top = `${startY}px`;
                lineEl.style.transform = `rotate(${rotationAngle}deg)`;
                container.appendChild(lineEl);
            }

            formatBytes(bytes, decimals = 2) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals < 0 ? 0 : decimals))} ${['Bytes', 'KB', 'MB', 'GB'][i]}`;
            }

            showLoading(elementId) {
                const target = document.getElementById(elementId);
                if(target) target.innerHTML = `<div class="file-info">Processing...</div>`;
            }

            showError(elementId, message) {
                 const target = document.getElementById(elementId);
                if(target) target.innerHTML = `<div class="file-info">${message}</div>`;
            }

            delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
        }

        const huffmanCompressor = new HuffmanCompressor();