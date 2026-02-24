tsc --project tsconfig.json
rm -rf static/**/
mv dist/* static/

./backend/app_store/app_data/pack.sh