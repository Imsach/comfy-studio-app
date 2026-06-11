# ComfyUI Studio

A modern web-based interface for AI image, audio, and 3D generation powered by ComfyUI. (Powered by StonkLab.com)

---

## Features

* **Text-to-Image Generation**
* **Image Editing**
* **Multi-Image Editing**
* **Audio Generation**
* **3D Asset Generation**
* **Workflow Management**
* **Real-Time Preview**
* **Batch Processing**
* **Multi-GPU Support**
* **Multi-Server Support**
* **ComfyUI Integration**
* **Remote GPU Server Support**

---

## Tech Stack

### Frontend

* React
* TypeScript
* Tailwind CSS
* Vite

### AI Pipeline

* ComfyUI
* ComfyUI API
* Custom workflows

---

# Architecture

ComfyUI Studio connects to one or more ComfyUI servers through their HTTP API.

Example deployment:

```
ComfyUI Studio
       │
       ▼
Job Router
       │
 ┌─────┴─────┐
 ▼           ▼
GPU Server 1 GPU Server 2
 │   │       │   │
8188 8189    8190 8191
GPU0 GPU1    GPU0 GPU1
```

Each ComfyUI instance runs independently on a dedicated GPU.

---

# Prerequisites

## Frontend

* Node.js 18+
* npm or pnpm

## GPU Servers

* Ubuntu 22.04/24.04
* NVIDIA GPU
* NVIDIA Drivers
* CUDA-compatible drivers
* Python 3.10+
* Git
* tmux

Recommended VRAM:

| Task  | Recommended VRAM |
| ----- | ---------------- |
| SDXL  | 12GB+            |
| Flux  | 12GB+            |
| Audio | 8GB+             |
| 3D    | 12GB+            |

---

# Installation

## Clone Repository

```bash
git clone https://github.com/imsach/comfy-studio-app.git
cd comfy-studio-app
```

---

## Install Frontend Dependencies

```bash
npm install
```

---

## Start Development Server

```bash
npm run dev
```

Frontend runs on:

```
http://localhost:5173
```

---

# GPU Server Setup

## Install NVIDIA Drivers

Verify GPU detection:

```bash
nvidia-smi
```

Example:

```
GPU 0: RTX 3060
GPU 1: RTX 3060
```

---

## Install Dependencies

```bash
sudo apt update

sudo apt install -y \
python3 \
python3-venv \
python3-pip \
git \
tmux
```

---

# Install ComfyUI

```bash
git clone https://github.com/comfyanonymous/ComfyUI.git

cd ComfyUI

python3 -m venv venv

source venv/bin/activate

pip install --upgrade pip

pip install -r requirements.txt
```

---

# Download Models

Download required models into the appropriate ComfyUI directories.

## Checkpoints

Place in:

```
ComfyUI/models/checkpoints/
```

Examples:

### Stable Diffusion XL

```
sd_xl_base_1.0.safetensors
```

### Flux

```
flux1-dev.safetensors
flux1-schnell.safetensors
```

---

## VAE Models

Place in:

```
ComfyUI/models/vae/
```

Examples:

```
ae.safetensors
sdxl_vae.safetensors
```

---

## CLIP Models

Place in:

```
ComfyUI/models/clip/
```

Examples:

```
clip_l.safetensors
t5xxl_fp16.safetensors
```

Flux workflows typically require T5 and CLIP models.

---

## LoRA Models

Place in:

```
ComfyUI/models/loras/
```

---

## ControlNet Models

Place in:

```
ComfyUI/models/controlnet/
```

---

## Upscale Models

Place in:

```
ComfyUI/models/upscale_models/
```

Examples:

```
4x-UltraSharp.pth
RealESRGAN_x4plus.pth
```

---

# Import Workflows

ComfyUI Studio workflows are located in:

```
public/workflows/
```

Examples:

```
text_to_image.json
image_edit.json
audio.json
3d.json
```

Ensure all models required by a workflow are installed on the GPU servers.

---

# Running ComfyUI

## Single GPU

```bash
source venv/bin/activate

python main.py --listen --port 8188
```

Accessible via:

```
http://SERVER_IP:8188
```

---

# Running Multiple GPUs

Recommended approach: one ComfyUI instance per GPU.

## GPU 0

```bash
CUDA_VISIBLE_DEVICES=0 \
python main.py \
--listen \
--port 8188
```

---

## GPU 1

```bash
CUDA_VISIBLE_DEVICES=1 \
python main.py \
--listen \
--port 8189
```

Example:

```
http://SERVER_IP:8188
http://SERVER_IP:8189
```

---

# Running Under tmux

tmux allows ComfyUI to continue running after disconnecting SSH.

---

## Create Session

```bash
tmux new -s comfy-gpu0
```

Start ComfyUI:

```bash
CUDA_VISIBLE_DEVICES=0 \
python main.py \
--listen \
--port 8188
```

Detach:

```
CTRL+B D
```

---

## GPU 1 Session

```bash
tmux new -s comfy-gpu1
```

Start:

```bash
CUDA_VISIBLE_DEVICES=1 \
python main.py \
--listen \
--port 8189
```

Detach:

```
CTRL+B D
```

---

## List Sessions

```bash
tmux ls
```

---

## Reattach

```bash
tmux attach -t comfy-gpu0

tmux attach -t comfy-gpu1
```

---

# Multi-Server Deployment

Example:

## Server 1

```
GPU0 → 8188
GPU1 → 8189
```

---

## Server 2

```
GPU0 → 8190
GPU1 → 8191
```

ComfyUI Studio Server Configuration:

```json
[
    "http://server1:8188",
    "http://server1:8189",
    "http://server2:8190",
    "http://server2:8191"
]
```

Jobs can be distributed across all available GPUs.

---

# Firewall

Allow ComfyUI ports:

```bash
sudo ufw allow 8188
sudo ufw allow 8189
sudo ufw allow 8190
sudo ufw allow 8191
```

---

# Verify Connectivity

Open:

```
http://SERVER_IP:8188
```

or

```
http://SERVER_IP:8189
```

You should see the ComfyUI interface.

---

# Frontend Configuration

Configure GPU servers inside ComfyUI Studio Settings.

Example:

```json
[
    {
        "name": "GPU-0",
        "url": "http://192.168.1.100:8188"
    },
    {
        "name": "GPU-1",
        "url": "http://192.168.1.100:8189"
    }
]
```

---

# Production Recommendations

* One ComfyUI instance per GPU
* Run ComfyUI inside tmux
* Use dedicated ports for each GPU
* Separate image and audio workloads when possible
* Store models on fast SSD/NVMe storage
* Keep workflow JSON files version controlled
* Monitor GPU utilization using:

```bash
watch -n 1 nvidia-smi
```

---

# Troubleshooting

## Check GPU Detection

```bash
nvidia-smi
```

---

## Check PyTorch GPU Count

```bash
python -c "import torch; print(torch.cuda.device_count())"
```

---

## Verify ComfyUI Port

```bash
ss -tulpn | grep 8188
```

---

## View tmux Sessions

```bash
tmux ls
```

---

## View ComfyUI Logs

Reattach to tmux:

```bash
tmux attach -t comfy-gpu0
```

---

# License

Copyright (c) 2026 StonkLab.

All rights reserved.
