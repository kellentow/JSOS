# This script is used to create a zip file of the current directory excluding the package.sh file
start=$(pwd)
cd "$(dirname "$0")"
zip -r ../file_explorer.zip * -x package.sh
cd $start