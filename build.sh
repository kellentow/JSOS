echo "Building kernel"
#tsc --noEmit
esbuild src/**/*.ts \
  --outdir=dist \
  --target=esnext \
  --format=esm \
  --platform=browser \
  --sourcemap \
  --loader:.ts=ts \
  --define:BUILD='"'"$(tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 16)"'"'
rm -rf static/**/
mv dist/* static/

./backend/app_store/app_data/pack.sh