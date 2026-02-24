SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
pushd "$SCRIPT_DIR" > /dev/null

mkdir tmp_build

echo "Compiling apps..."

for d in "$SCRIPT_DIR"/*/ ; do
    rm -rf tmp_build/*
    DIR_NAME="$(basename "${d%/}")"
    echo ""

    if [ "$DIR_NAME" = "tmp_build" ]; then
        continue
    fi
    
    echo "Compiling app: $DIR_NAME"
    pushd $DIR_NAME > /dev/null

    esbuild ./src/index.ts --outdir="../tmp_build/" --minify
    if [ $? -ne 0 ]; then
        echo "Build failed for $DIR_NAME (esbuild error)"
        exit 1
    fi

    pushd ../tmp_build/ > /dev/null

    zip -r "../$(basename $DIR_NAME).zip" ./*
    if [ $? -ne 0 ]; then
        echo "Build failed for $DIR_NAME (zip error)"
        exit 1
    fi

    popd > /dev/null

    cp "./app.json" "../$(basename $DIR_NAME).metadata"

    popd > /dev/null
done

rm -rf tmp_build

popd > /dev/null