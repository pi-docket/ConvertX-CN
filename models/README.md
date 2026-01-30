# ConvertX-CN 模型目錄

此目錄存放 ConvertX-CN 所需的預下載模型。

## 📦 目錄結構

```
models/
├── doclayout_yolo_docstructbench_imgsz1024.onnx  # BabelDOC ONNX (~30MB)
└── mineru/                                        # MinerU 模型 (Git忽略)
    ├── PDF-Extract-Kit-1.0/                       # Pipeline 模型 (~1.5GB)
    └── MinerU-VLM-GGUF/                           # VLM GGUF Q8_0 (~600MB)
```

## 🔽 下載模型

在 Docker build 前，需要先下載模型：

```bash
pip install huggingface_hub
python scripts/download-models-local.py
```

## ⚠️ 注意

- mineru/ 目錄已加入 .gitignore
- 每次 clone 後需重新執行下載腳本
