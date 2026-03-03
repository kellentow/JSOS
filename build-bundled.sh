./backend/app_store/app_data/pack.sh

mkdir bundle_backend

mkdir bundle_backend/app_store

mkdir bundle_backend/app_store/download
mkdir bundle_backend/app_store/app_data

cp -r backend/app_store/app_data/*.zip bundle_backend/app_store/download
cp -r backend/app_store/app_data/*.metadata bundle_backend/app_store/app_data

shopt -s nullglob
cd bundle_backend/app_store/download
for file in *; do
    new_name="${file%.*}"
    mv "$file" "$new_name"
done
cd ../../../

cd bundle_backend/app_store/app_data
for file in *; do
    new_name="${file%.*}"
    mv "$file" "$new_name"
done
cd ../../../
shopt -u nullglob

python3 pack.py ./bundle_backend/ ./src/assets.json

rm -rf bundle_backend

echo "Building kernel"
#tsc --noEmit
esbuild src/os.ts \
  --outdir=dist \
  --target=es2022 \
  --format=esm \
  --platform=browser \
  --sourcemap \
  --loader:.ts=ts \
  --bundle \
  --define:BUILD='"'"$(tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 16)"'"' \
  --define:BUILD_TYPE='"bundle"' #\
  #--minify

rm dist/jsos.html
touch dist/jsos.html
echo "<!DOCTYPE html><html><head><meta charset='utf-8'><title>JSOS Bundled</title></head><body><script type='module'>" > dist/jsos.html
cat dist/os.js >> dist/jsos.html
echo "</script></body></html>" >> dist/jsos.html