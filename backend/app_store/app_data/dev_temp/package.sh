# This script is used to create a zip file of the current directory excluding the package.sh file
start=$(pwd)
cd "$(dirname "$0")"
zip -r ../task_manager.zip * -x package.sh
cd $start 