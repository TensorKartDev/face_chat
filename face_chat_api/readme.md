### Convert .heic and .HEIC files to jpg or jpeg

```
find /path/to/personas -type f -name "*.heic" -exec sh -c 'sips -s format jpeg "$1" --out "${1%.heic}.jpg"' _ {} \;

-- Some images have extension .HEIC
find /path/to/personas -type f -name "*.HEIC" -exec sh -c 'sips -s format jpeg "$1" --out "${1%.HEIC}.jpg"' _ {} \;
```

## For mac : Metal (MPS) backend for Apple Silicon
```
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/nightly/cpu

```