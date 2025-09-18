#include <iostream>
#include <fstream>
#include <unordered_map>
#include <queue>
#include <vector>
#include <string>
#include <bitset>

using namespace std;

struct Node {
    char ch;
    int freq;
    Node *left, *right;

    Node(char c, int f) : ch(c), freq(f), left(nullptr), right(nullptr) {}
    Node(char c, int f, Node* l, Node* r) : ch(c), freq(f), left(l), right(r) {}
};

struct Compare {
    bool operator()(Node* a, Node* b) {
        return a->freq > b->freq;
    }
};

Node* buildHuffmanTree(const unordered_map<char,int>& freq) {
    priority_queue<Node*, vector<Node*>, Compare> pq;
    for (auto& p : freq) pq.push(new Node(p.first, p.second));

    while (pq.size() > 1) {
        Node* left = pq.top(); pq.pop();
        Node* right = pq.top(); pq.pop();
        pq.push(new Node('\0', left->freq + right->freq, left, right));
    }
    return pq.top();
}

void generateCodes(Node* root, string code, unordered_map<char,string>& codes) {
    if (!root) return;
    if (!root->left && !root->right) codes[root->ch] = code;
    generateCodes(root->left, code + "0", codes);
    generateCodes(root->right, code + "1", codes);
}

string encode(const string& text, unordered_map<char,string>& codes) {
    string bits;
    for (char c : text) bits += codes[c];
    return bits;
}

string decode(const string& bits, Node* root) {
    string text;
    Node* cur = root;
    for (char b : bits) {
        cur = (b == '0') ? cur->left : cur->right;
        if (!cur->left && !cur->right) {
            text += cur->ch;
            cur = root;
        }
    }
    return text;
}

// Save compressed binary
void saveCompressed(const string& filename, const string& bits, unordered_map<char,string>& codes) {
    ofstream out(filename, ios::binary);
    if (!out) {
        cerr << "Error: Cannot open output file " << filename << endl;
        exit(1);
    }

    // Write frequency table
    out << codes.size() << "\n";
    for (auto& p : codes) {
        out << (int)(unsigned char)p.first << " " << p.second << "\n";
    }

    // Write padding + binary data
    int padding = (8 - (bits.size() % 8)) % 8;
    out << padding << "\n";

    string padded = bits + string(padding, '0');
    for (size_t i = 0; i < padded.size(); i += 8) {
        bitset<8> byte(padded.substr(i, 8));
        out.put((unsigned char)byte.to_ulong());
    }
    out.close();
}

// Load compressed binary
pair<string, unordered_map<string,char>> loadCompressed(const string& filename) {
    ifstream in(filename, ios::binary);
    if (!in) {
        cerr << "Error: Cannot open file " << filename << endl;
        exit(1);
    }

    int n; in >> n;
    unordered_map<string,char> decodeMap;
    for (int i = 0; i < n; i++) {
        int c; string code;
        in >> c >> code;
        decodeMap[code] = (char)c;
    }

    int padding; in >> padding;
    in.ignore(); // Skip newline

    string bits;
    char byte;
    while (in.get(byte)) {
        bitset<8> b((unsigned char)byte);
        bits += b.to_string();
    }

    bits.erase(bits.end()-padding, bits.end());
    return make_pair(bits, decodeMap);
}

int main(int argc, char* argv[]) {
    if (argc < 4) {
        cerr << "Usage:\n"
             << "  " << argv[0] << " -c <input.txt> <output.huf>\n"
             << "  " << argv[0] << " -d <input.huf> <output.txt>\n";
        return 1;
    }

    string mode = argv[1];
    if (mode == "-c") {
        string inputFile = argv[2];
        string outputFile = argv[3];

        ifstream in(inputFile, ios::binary);
        if (!in) {
            cerr << "Error: Cannot open file " << inputFile << endl;
            return 1;
        }
        string text((istreambuf_iterator<char>(in)), {});
        in.close();

        if (text.empty()) {
            cerr << "Error: Input file is empty!" << endl;
            return 1;
        }

        unordered_map<char,int> freq;
        for (char c : text) freq[c]++;

        Node* root = buildHuffmanTree(freq);
        unordered_map<char,string> codes;
        generateCodes(root, "", codes);

        string bits = encode(text, codes);
        saveCompressed(outputFile, bits, codes);

        cout << "Compressed " << text.size() << " bytes -> " 
             << bits.size()/8 << " bytes\n";

    } else if (mode == "-d") {
        string inputFile = argv[2];
        string outputFile = argv[3];

        pair<string, unordered_map<string,char>> result = loadCompressed(inputFile);
        string bits = result.first;
        unordered_map<string,char> decodeMap = result.second;

        string text, temp;
        for (char b : bits) {
            temp += b;
            if (decodeMap.count(temp)) {
                text += decodeMap[temp];
                temp.clear();
            }
        }

        ofstream out(outputFile, ios::binary);
        out << text;
        out.close();

        cout << "Decompressed to " << outputFile << " (" << text.size() << " bytes)\n";

    } else {
        cerr << "Invalid mode! Use -c to compress, -d to decompress\n";
        return 1;
    }

    return 0;
}
