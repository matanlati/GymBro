import subprocess

try:
    import torch
    print("CUDA available:", torch.cuda.is_available())
    print("GPU count:", torch.cuda.device_count())
    for i in range(torch.cuda.device_count()):
        print(f"GPU {i}: {torch.cuda.get_device_name(i)}")
except ImportError:
    result = subprocess.run(["nvidia-smi", "-L"], capture_output=True, text=True)
    print(result.stdout or "No GPU found or nvidia-smi unavailable")
